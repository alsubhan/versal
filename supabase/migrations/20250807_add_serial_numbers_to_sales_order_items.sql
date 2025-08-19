-- Migration: Add serial numbers support to sales_order_items table
-- Date: 2025-08-07
-- Description: Add serialNumbers column to store serial numbers for serialized products in sales orders

-- Note: We don't store serial numbers in sales_order_items
-- Sales orders are planning documents - actual serials are selected at invoice time
-- from the product_serials table where status = 'available'

-- Create index for better performance when querying by product_id
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id 
ON public.sales_order_items (product_id);

-- Update the existing sales_order_items table structure to match the enhanced schema
-- This ensures consistency with other item tables that have been enhanced
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS sku_code TEXT,
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS sale_tax_type TEXT DEFAULT 'exclusive',
ADD COLUMN IF NOT EXISTS unit_abbreviation TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Add comments for new columns
COMMENT ON COLUMN public.sales_order_items.product_name IS 'Product name for display purposes';
COMMENT ON COLUMN public.sales_order_items.sku_code IS 'Product SKU code';
COMMENT ON COLUMN public.sales_order_items.hsn_code IS 'Product HSN code';
COMMENT ON COLUMN public.sales_order_items.sale_tax_type IS 'Tax type: exclusive or inclusive';
COMMENT ON COLUMN public.sales_order_items.unit_abbreviation IS 'Unit abbreviation (e.g., pcs, kg, box)';
COMMENT ON COLUMN public.sales_order_items.created_by IS 'User who created this item';

-- Update the total calculation to use the new tax handling
-- Drop the existing generated column
ALTER TABLE public.sales_order_items DROP COLUMN IF EXISTS total;

-- Recreate the total column with proper tax calculation
ALTER TABLE public.sales_order_items 
ADD COLUMN total DECIMAL(12,2) GENERATED ALWAYS AS (
    CASE 
        WHEN sale_tax_type = 'inclusive' THEN (quantity * unit_price) - discount
        ELSE (quantity * unit_price) - discount + tax
    END
) STORED;
