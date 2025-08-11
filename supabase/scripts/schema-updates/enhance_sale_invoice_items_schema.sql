-- Enhance sale_invoice_items table with missing product snapshot and audit fields
-- This migration adds the recommended fields for complete sale invoice functionality

-- Add reference to original sales order item (optional but recommended)
ALTER TABLE public.sale_invoice_items 
ADD COLUMN sales_order_item_id UUID REFERENCES public.sales_order_items(id);

-- Add product snapshot columns (for historical accuracy and performance)
ALTER TABLE public.sale_invoice_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT;

-- Add audit trail field
ALTER TABLE public.sale_invoice_items 
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sale_invoice_items_sales_order_item_id ON public.sale_invoice_items(sales_order_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_invoice_items_created_by ON public.sale_invoice_items(created_by);

-- Add comments explaining the purpose of new columns
COMMENT ON COLUMN public.sale_invoice_items.sales_order_item_id IS 'Reference to original sales order item (optional)';
COMMENT ON COLUMN public.sale_invoice_items.product_name IS 'Product name at time of invoice (for historical accuracy)';
COMMENT ON COLUMN public.sale_invoice_items.sku_code IS 'Product SKU at time of invoice (for historical accuracy)';
COMMENT ON COLUMN public.sale_invoice_items.hsn_code IS 'Product HSN code at time of invoice (for historical accuracy)';
COMMENT ON COLUMN public.sale_invoice_items.sale_tax_type IS 'Tax type (inclusive/exclusive) at time of invoice';
COMMENT ON COLUMN public.sale_invoice_items.unit_abbreviation IS 'Unit abbreviation at time of invoice';
COMMENT ON COLUMN public.sale_invoice_items.created_by IS 'User who created the invoice item'; 