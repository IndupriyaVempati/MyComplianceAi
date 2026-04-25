import os
import stripe
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

try:
    cus_id = "cus_U6yhcLCTX6RZ4U"
    subs = stripe.Subscription.list(customer=cus_id, status="active")
    print(f"Active subscriptions for {cus_id}: {len(subs['data'])}")
    for s in subs['data']:
        item = s["items"]["data"][0]
        print(f"  - Sub {s['id']}: {item['plan']['id']} | Amount: {item['plan']['amount']}")
        
    # Let's also check the invoice items directly
    items = stripe.InvoiceItem.list(customer=cus_id, pending=True)
    print(f"\nPending invoice items (prorations): {len(items['data'])}")
    for i in items['data']:
        print(f"  - {i['description']} | Amount: {i['amount']}")
except Exception as e:
    import traceback
    print(traceback.format_exc())
