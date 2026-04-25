-- Down migration
ALTER TABLE "user" DROP COLUMN IF EXISTS plan_type;
ALTER TABLE "user" DROP COLUMN IF EXISTS stripe_customer_id;
