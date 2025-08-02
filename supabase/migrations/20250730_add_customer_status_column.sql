-- Add is_active column to customers table
ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT true;
-- Update existing customers to be active by default
UPDATE customers SET is_active = true WHERE is_active IS NULL;
-- Add comment to the column
COMMENT ON COLUMN customers.is_active IS 'Whether the customer is active or inactive'; 