-- Add missing fields to products table
-- Migration: 20250730_add_missing_product_fields.sql

-- Add MRP (Maximum Retail Price) field
ALTER TABLE public.products 
ADD COLUMN mrp DECIMAL(12,2);

-- Add Sale Price field (separate from selling_price)
ALTER TABLE public.products 
ADD COLUMN sale_price DECIMAL(12,2);

-- Add Subcategory ID field (for hierarchical categories)
ALTER TABLE public.products 
ADD COLUMN subcategory_id UUID REFERENCES public.categories(id);

-- Create indexes for new fields
CREATE INDEX idx_products_mrp ON public.products(mrp);
CREATE INDEX idx_products_sale_price ON public.products(sale_price);
CREATE INDEX idx_products_subcategory_id ON public.products(subcategory_id);

-- Add comments for documentation
COMMENT ON COLUMN public.products.mrp IS 'Maximum Retail Price (MRP) for the product';
COMMENT ON COLUMN public.products.sale_price IS 'Sale price (different from selling_price/retail price)';
COMMENT ON COLUMN public.products.subcategory_id IS 'Reference to subcategory in the categories table'; 