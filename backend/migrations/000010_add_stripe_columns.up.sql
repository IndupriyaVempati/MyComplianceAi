-- Add stripe_customer_id and plan_type to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) NOT NULL DEFAULT 'freemium';
