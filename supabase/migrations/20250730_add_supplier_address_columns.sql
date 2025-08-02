-- Add billing_address and shipping_address columns to suppliers table as JSONB
ALTER TABLE suppliers ADD COLUMN billing_address JSONB;
ALTER TABLE suppliers ADD COLUMN shipping_address JSONB;

-- Update existing suppliers to use the current address as billing_address
-- Convert the existing TEXT address to a structured JSONB format
UPDATE suppliers SET billing_address = jsonb_build_object(
    'street', address,
    'city', '',
    'state', '',
    'zipCode', '',
    'country', ''
) WHERE billing_address IS NULL AND address IS NOT NULL;

-- Add comments to the columns
COMMENT ON COLUMN suppliers.billing_address IS 'Billing address for the supplier (JSONB with street, city, state, zipCode, country)';
COMMENT ON COLUMN suppliers.shipping_address IS 'Shipping address for the supplier (JSONB with street, city, state, zipCode, country)'; 