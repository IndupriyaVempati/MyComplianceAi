import os
import stripe
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

async def main():
    conn = await asyncpg.connect(user="postgres", password="8360527432", database="opengpts", host="postgres")
    users = await conn.fetch("SELECT username, stripe_customer_id, plan_type FROM \"user\" WHERE stripe_customer_id IS NOT NULL")
    for u in users:
        cus_id = u["stripe_customer_id"]
        if cus_id:
            print(f"Customer: {cus_id}, Email: {u['username']}, Plan: {u['plan_type']}")
            try:
                upc = stripe.Invoice.upcoming(customer=cus_id)
                lines = upc.get("lines", {}).get("data", [])
                print(f"  Upcoming invoice lines: {len(lines)}")
                for l in lines:
                    print(f"    - Type: {l.get('type')} | Proration: {l.get('proration')} | Desc: {l.get('description')} | Amount: {l.get('amount')}")
            except Exception as e:
                print(f"  No upcoming invoice. {e}")
    await conn.close()

asyncio.run(main())
