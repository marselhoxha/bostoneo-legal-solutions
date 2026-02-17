-- Add Stripe customer ID to clients table for payment gateway integration
ALTER TABLE clients
ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER phone;

-- Add index for faster lookups
CREATE INDEX idx_clients_stripe_customer_id ON clients(stripe_customer_id);