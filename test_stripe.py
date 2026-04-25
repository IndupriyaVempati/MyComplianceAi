import os
import stripe
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

customer_id = "cus_RydM8tI6C8cO2H" # Need to get a real customer id from db, wait I can just write a quick script to query db.
