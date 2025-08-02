-- Add tax type fields to products table
-- Migration: 20250730_add_tax_type_fields.sql

-- Add Sale Tax Type field (inclusive/exclusive)
ALTER TABLE public.products 
ADD COLUMN sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive';

-- Add Purchase Tax Type field (inclusive/exclusive)
ALTER TABLE public.products 
ADD COLUMN purchase_tax_type TEXT CHECK (purchase_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive';

-- Create indexes for new fields
CREATE INDEX idx_products_sale_tax_type ON public.products(sale_tax_type);
CREATE INDEX idx_products_purchase_tax_type ON public.products(purchase_tax_type);

-- Add comments for documentation
COMMENT ON COLUMN public.products.sale_tax_type IS 'Tax type for sale tax: inclusive or exclusive';
COMMENT ON COLUMN public.products.purchase_tax_type IS 'Tax type for purchase tax: inclusive or exclusive'; 