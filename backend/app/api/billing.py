import os
import json
import stripe
from typing import List
from fastapi import APIRouter, HTTPException, Request, Depends, Response
from pydantic import BaseModel
import app.storage as storage
from app.auth.handlers import AuthedUser

# Set your Stripe API key here
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
stripe_webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET_THIN") or os.environ.get("STRIPE_WEBHOOK_SECRET_SNAPSHOT") or os.environ.get("STRIPE_WEBHOOK_SECRET")

# Domain for redirecting back after checkout
# Assuming frontend running on same host, or pulling from request
DOMAIN = os.environ.get("FRONTEND_URL", "http://localhost:5173")

router = APIRouter()

class CheckoutSessionRequest(BaseModel):
    plan_id: str
    interval: str = "month" # 'month' or 'year'

async def get_or_create_product(name: str, description: str) -> str:
    """Retrieve an existing product by name or create a new one."""
    products = stripe.Product.list(limit=10) # Simple name-based lookup
    for p in products["data"]:
        if p["name"] == name:
            return p["id"]
    
    new_product = stripe.Product.create(name=name, description=description)
    return new_product["id"]

@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutSessionRequest, user: AuthedUser):
    """
    Upgrade or downgrade the user's plan.
    - Existing subscribers: modify the subscription in-place (with proration, no redirect).
    - New subscribers: create a Stripe Checkout Session and return the redirect URL.
    """
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured on the backend.")

    try:
        # Get the full user profile
        db_user = await storage.get_user_by_id(user.sub)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create or retrieve Stripe Customer
        customer_id = db_user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=db_user.username,
                name=db_user.name,
                metadata={"user_id": str(db_user.user_id), "sub": db_user.sub}
            )
            customer_id = customer.id
            async with storage.get_pg_pool().acquire() as conn:
                await conn.execute(
                    'UPDATE "user" SET stripe_customer_id = $1 WHERE user_id = $2',
                    customer_id, db_user.user_id
                )

        prices = {
            "basic": {"month": 100, "year": 1000},
            "pro":   {"month": 200, "year": 2000},
            "ultra": {"month": 300, "year": 3000},
        }
        plan_names = {
            "basic": "Basic Subscription",
            "pro":   "Pro Subscription",
            "ultra": "Ultra Subscription"
        }

        plan_id = request.plan_id.lower()
        if plan_id not in prices:
            raise HTTPException(status_code=400, detail="Invalid plan_id")

        interval = request.interval.lower()
        if interval not in ["month", "year"]:
            raise HTTPException(status_code=400, detail="Invalid interval")

        unit_amount = prices[plan_id][interval]
        plan_name = plan_names[plan_id]
        plan_desc = f"Access to {plan_names[plan_id]}"

        # ── Check for an existing active subscription ──────────────────────
        existing_subs = stripe.Subscription.list(
            customer=customer_id, status="active", limit=1
        )

        if existing_subs["data"]:
            # Modify the existing subscription (upgrade or downgrade with proration)
            # You cannot update price_data on an existing item, so we delete the old and add a new one.
            # Also, price_data does NOT support inline product_data here, so we must use a product_id.
            sub = existing_subs["data"][0]
            item_id = sub["items"]["data"][0]["id"]
            product_id = await get_or_create_product(plan_name, plan_desc)

            stripe.Subscription.modify(
                sub["id"],
                items=[
                    {"id": item_id, "deleted": True},
                    {
                        "price_data": {
                            "currency": "usd",
                            "product": product_id,
                            "unit_amount": unit_amount,
                            "recurring": {"interval": interval},
                        },
                    }
                ],
                metadata={"plan_type": plan_id},
                proration_behavior="create_prorations",
            )

            # Update the user's plan in the DB immediately
            async with storage.get_pg_pool().acquire() as conn:
                await conn.execute(
                    'UPDATE "user" SET plan_type = $1 WHERE sub = $2',
                    plan_id, user.sub
                )

            return {"status": "modified", "plan_type": plan_id}

        # ── No existing subscription — new subscriber, create Checkout Session ──
        # Note: checkout sessions DO support inline product_data
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': plan_name,
                        'description': plan_desc,
                    },
                    'unit_amount': unit_amount,
                    'recurring': {'interval': interval},
                },
                'quantity': 1,
            }],
            mode='subscription',
            metadata={'plan_type': plan_id},
            subscription_data={'metadata': {'plan_type': plan_id}},
            success_url=f"{DOMAIN}/plan?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{DOMAIN}/plan?canceled=true",
        )
        return {"url": checkout_session.url}


    except Exception as e:
        print(f"STRIPE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-session")
async def verify_session(session_id: str, user: AuthedUser):
    """
    Verify the checkout session when the user is immediately redirected back to the frontend.
    This provides an instant visual update before the webhook fires.
    """
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")
        
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status in ["paid", "no_payment_required"]:
            plan_type = session.metadata.get("plan_type", "premium") if session.get("metadata") else "premium"
            # Update user plan
            async with storage.get_pg_pool().acquire() as conn:
                await conn.execute(
                    'UPDATE "user" SET plan_type = $1 WHERE sub = $2',
                    plan_type, user.sub
                )
            return {"status": "success", "plan_type": plan_type}
        return {"status": session.payment_status, "plan_type": "freemium"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/plan")
async def get_plan(user: AuthedUser):
    """Get the current user's active billing plan."""
    db_user = await storage.get_user_by_id(user.sub)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    interval = "month"
    if db_user.stripe_customer_id and db_user.plan_type != "freemium":
        try:
            subs = stripe.Subscription.list(customer=db_user.stripe_customer_id, status="active", limit=1)
            if subs["data"]:
                sub = subs["data"][0]
                if sub.get("items") and sub["items"].get("data") and len(sub["items"]["data"]) > 0:
                    interval = sub["items"]["data"][0]["price"]["recurring"]["interval"]
        except Exception:
            pass

    return {
        "plan_type": db_user.plan_type,
        "stripe_customer_id": db_user.stripe_customer_id,
        "interval": interval
    }

def get_clean_plan_name(description: str, interval: str = "month") -> str:
    if not description:
        return "Subscription"
    desc_lower = description.lower()
    
    period = "Annual" if interval.lower() == "year" else "Monthly"
    
    if "ultra" in desc_lower:
        return f"Ultra ({period})"
    elif "premium" in desc_lower:
        return f"Premium ({period})"
    elif "pro" in desc_lower:
        return f"Pro ({period})"
    elif "basic" in desc_lower:
        return f"Basic ({period})"
    return "Subscription"

@router.get("/history")
async def get_history(user: AuthedUser):
    """Fetch invoice history for the user from Stripe."""
    db_user = await storage.get_user_by_id(user.sub)
    if not db_user or not db_user.stripe_customer_id:
        return []

    try:
        history = []
        
        # 1. Fetch pending upgrades/downgrades from pending InvoiceItems
        try:
            pending_items = stripe.InvoiceItem.list(customer=db_user.stripe_customer_id, pending=True)
            for item in pending_items["data"]:
                interval = "month"
                if item.get("plan") and item["plan"].get("interval"):
                    interval = item["plan"]["interval"]
                plan_name = get_clean_plan_name(item.get("description", ""), interval)
                history.append({
                    "id": item["id"],
                    "event_name": "Pending Modification",
                    "plan_name": plan_name,
                    "amount_paid": item["amount"],
                    "currency": item["currency"],
                    "status": "pending",
                    "created": item["date"],
                    "period_end": item["period"]["end"] if item.get("period") else None,
                    "hosted_invoice_url": None,
                    "invoice_pdf": None
                })
        except Exception as e:
            print(f"Failed to fetch pending invoice items: {e}")

        # 2. Fetch past paid/open invoices
        invoices = stripe.Invoice.list(customer=db_user.stripe_customer_id, limit=24)
        for inv in invoices["data"]:
            # inv.period_end on the first invoice equals the purchase date.
            # The real expiry is the subscription's current_period_end.
            expiry = None
            if inv.get("subscription"):
                try:
                    sub = stripe.Subscription.retrieve(inv["subscription"])
                    expiry = sub["current_period_end"]
                except Exception:
                    expiry = inv["period_end"]
            else:
                expiry = inv["period_end"]

            plan_desc = "Subscription"
            interval = "month"
            if inv.get("lines") and inv["lines"].get("data") and len(inv["lines"]["data"]) > 0:
                lines = inv["lines"]["data"]
                # 1. Try to find a normal non-proration line item
                sub_lines = [line for line in lines if not line.get("proration")]
                
                # 2. If it's a proration-only invoice, pick the line with an amount >= 0
                if not sub_lines:
                    sub_lines = [line for line in lines if line.get("amount", 0) >= 0]
                
                # 3. Fallback to the first line
                if not sub_lines:
                    sub_lines = lines
                
                target_line = sub_lines[0]
                plan_desc = target_line.get("description", "Subscription")
                if target_line.get("plan") and target_line["plan"].get("interval"):
                    interval = target_line["plan"]["interval"]
            
            plan_name = get_clean_plan_name(plan_desc, interval)
            
            billing_reason = inv.get("billing_reason")
            if billing_reason == "subscription_create":
                event_name = "Subscription Started"
            elif billing_reason == "subscription_cycle":
                event_name = "Subscription Renewal"
            elif billing_reason == "subscription_update":
                if inv.get("amount_paid", 0) > 0:
                    # Positive amount means they paid for an upgrade
                    event_name = f"Upgraded to {plan_name.split(' ')[0]}"
                else:
                    event_name = f"Downgraded to {plan_name.split(' ')[0]}"
            else:
                event_name = "Invoice Generated"

            history.append({
                "id": inv["id"],
                "event_name": event_name,
                "plan_name": plan_name,
                "amount_paid": inv["amount_paid"],
                "currency": inv["currency"],
                "status": inv["status"],
                "created": inv["created"],
                "period_end": expiry,
                "hosted_invoice_url": inv.get("hosted_invoice_url"),
                "invoice_pdf": inv.get("invoice_pdf")
            })
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe Webhook handler to asynchronously update subscriptions.
    """
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")

    if not stripe_webhook_secret:
        # Just skip verification locally if no secret is provided
        try:
            event = json.loads(payload)
        except json.decoder.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, stripe_webhook_secret
            )
        except ValueError as e:
            # Invalid payload
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_id = session.get('customer')
        
        if customer_id and session.get('payment_status') in ['paid', 'no_payment_required']:
            plan_type = session.get('metadata', {}).get('plan_type', 'premium') if session.get('metadata') else 'premium'
            
            # Fulfill the purchase (upgrade to plan)
            async with storage.get_pg_pool().acquire() as conn:
                await conn.execute(
                    'UPDATE "user" SET plan_type = $1 WHERE stripe_customer_id = $2',
                    plan_type, customer_id
                )
                
    elif event['type'] == 'customer.subscription.deleted':
        # Handle subscription cancellations/failures
        subscription = event['data']['object']
        customer_id = subscription.get('customer')
        
        if customer_id:
            async with storage.get_pg_pool().acquire() as conn:
                await conn.execute(
                    'UPDATE "user" SET plan_type = $1 WHERE stripe_customer_id = $2',
                    'freemium', customer_id
                )

    # Return a 200 to acknowledge receipt
    return Response(status_code=200)
