-- Add new fields to products table
-- Migration: 20250730_add_product_fields.sql

-- Add HSN Code field (mandatory)
ALTER TABLE public.products 
ADD COLUMN hsn_code TEXT NOT NULL DEFAULT '000000';

-- Add Manufacturer Part Number field
ALTER TABLE public.products 
ADD COLUMN manufacturer_part_number TEXT;

-- Add Supplier ID field (mandatory)
ALTER TABLE public.products 
ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);

-- Add Sale Tax ID field (mandatory)
ALTER TABLE public.products 
ADD COLUMN sale_tax_id UUID REFERENCES public.taxes(id);

-- Add Purchase Tax ID field (mandatory)
ALTER TABLE public.products 
ADD COLUMN purchase_tax_id UUID REFERENCES public.taxes(id);

-- Add Manufacturer field
ALTER TABLE public.products 
ADD COLUMN manufacturer TEXT;

-- Add Brand field
ALTER TABLE public.products 
ADD COLUMN brand TEXT;

-- Add Warranty Period field
ALTER TABLE public.products 
ADD COLUMN warranty_period INTEGER;

-- Add Warranty Unit field (days, months, years)
ALTER TABLE public.products 
ADD COLUMN warranty_unit TEXT CHECK (warranty_unit IN ('days', 'months', 'years'));

-- Add Product Tags field
ALTER TABLE public.products 
ADD COLUMN product_tags TEXT[];

-- Add Serialized Product field
ALTER TABLE public.products 
ADD COLUMN is_serialized BOOLEAN DEFAULT false;

-- Add Track Inventory field
ALTER TABLE public.products 
ADD COLUMN track_inventory BOOLEAN DEFAULT true;

-- Add Allow Override Price field
ALTER TABLE public.products 
ADD COLUMN allow_override_price BOOLEAN DEFAULT false;

-- Add Discount Percentage field
ALTER TABLE public.products 
ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Add Warehouse Rack field
ALTER TABLE public.products 
ADD COLUMN warehouse_rack TEXT;

-- Add Unit Conversion field (JSONB for storing conversion rules)
ALTER TABLE public.products 
ADD COLUMN unit_conversions JSONB;

-- Create indexes for better performance
CREATE INDEX idx_products_hsn_code ON public.products(hsn_code);
CREATE INDEX idx_products_supplier_id ON public.products(supplier_id);
CREATE INDEX idx_products_sale_tax_id ON public.products(sale_tax_id);
CREATE INDEX idx_products_purchase_tax_id ON public.products(purchase_tax_id);
CREATE INDEX idx_products_manufacturer ON public.products(manufacturer);
CREATE INDEX idx_products_brand ON public.products(brand);

-- Update existing products to have default HSN code
UPDATE public.products 
SET hsn_code = '000000' 
WHERE hsn_code IS NULL;

-- Make HSN code unique constraint
ALTER TABLE public.products 
ADD CONSTRAINT products_hsn_code_unique UNIQUE (hsn_code);

-- Add comments for documentation
COMMENT ON COLUMN public.products.hsn_code IS 'Harmonized System of Nomenclature code (6-digit uniform code for product classification)';
COMMENT ON COLUMN public.products.manufacturer_part_number IS 'Manufacturer Part Number (MPN) for the product';
COMMENT ON COLUMN public.products.supplier_id IS 'Reference to the supplier/vendor of this product';
COMMENT ON COLUMN public.products.sale_tax_id IS 'Tax applied when selling this product';
COMMENT ON COLUMN public.products.purchase_tax_id IS 'Tax applied when purchasing this product';
COMMENT ON COLUMN public.products.manufacturer IS 'Name of the product manufacturer';
COMMENT ON COLUMN public.products.brand IS 'Product brand name';
COMMENT ON COLUMN public.products.warranty_period IS 'Warranty period duration';
COMMENT ON COLUMN public.products.warranty_unit IS 'Unit for warranty period (days, months, years)';
COMMENT ON COLUMN public.products.product_tags IS 'Array of tags for searching and filtering products';
COMMENT ON COLUMN public.products.is_serialized IS 'Whether this product is serialized (tracked individually)';
COMMENT ON COLUMN public.products.track_inventory IS 'Whether to track inventory for this product';
COMMENT ON COLUMN public.products.allow_override_price IS 'Whether price can be overridden during sales';
COMMENT ON COLUMN public.products.discount_percentage IS 'Default discount percentage for this product';
COMMENT ON COLUMN public.products.warehouse_rack IS 'Warehouse rack location for this product';
COMMENT ON COLUMN public.products.unit_conversions IS 'JSON object storing unit conversion rules'; 