-- Upgrading Customers to support multiple addresses
ALTER TABLE customers ADD COLUMN IF NOT EXISTS additional_addresses JSONB DEFAULT '[]'::jsonb;

-- Ensuring the core Sales Outbound flows preserve literal historical addresses across both Billing and Shipping vectors
ALTER TABLE sale_quotations ADD COLUMN IF NOT EXISTS billing_address JSONB;
ALTER TABLE sale_quotations ADD COLUMN IF NOT EXISTS shipping_address JSONB;

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS billing_address JSONB;
-- sales_orders already has shipping_address

ALTER TABLE sale_invoices ADD COLUMN IF NOT EXISTS billing_address JSONB;
-- sale_invoices already has shipping_address

-- Backfill existing sales_orders and sale_invoices with their customer's historical billing addresses
UPDATE sales_orders so
SET billing_address = c.billing_address
FROM customers c
WHERE so.customer_id = c.id AND so.billing_address IS NULL;

UPDATE sale_invoices si
SET billing_address = c.billing_address
FROM customers c
WHERE si.customer_id = c.id AND si.billing_address IS NULL;
