-- Enhance good_receive_note_items table with missing product snapshot and pricing fields
-- This migration adds the recommended fields for complete GRN functionality

-- Add product snapshot columns (for historical accuracy and performance)
ALTER TABLE public.good_receive_note_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN purchase_tax_type TEXT CHECK (purchase_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT;

-- Add pricing fields (for receipt-specific pricing that may differ from PO)
ALTER TABLE public.good_receive_note_items 
ADD COLUMN discount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN tax DECIMAL(12,2) DEFAULT 0,
ADD COLUMN total DECIMAL(12,2) GENERATED ALWAYS AS 
  (((received_quantity - rejected_quantity) * unit_cost) - discount + tax) STORED;

-- Add created_by field for audit trail
ALTER TABLE public.good_receive_note_items 
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_grn_items_created_by ON public.good_receive_note_items(created_by);

-- Add comment explaining the purpose of product snapshot columns
COMMENT ON COLUMN public.good_receive_note_items.product_name IS 'Product name at time of receipt (for historical accuracy)';
COMMENT ON COLUMN public.good_receive_note_items.sku_code IS 'Product SKU at time of receipt (for historical accuracy)';
COMMENT ON COLUMN public.good_receive_note_items.hsn_code IS 'Product HSN code at time of receipt (for historical accuracy)';
COMMENT ON COLUMN public.good_receive_note_items.purchase_tax_type IS 'Tax type (inclusive/exclusive) at time of receipt';
COMMENT ON COLUMN public.good_receive_note_items.unit_abbreviation IS 'Unit abbreviation at time of receipt';
COMMENT ON COLUMN public.good_receive_note_items.discount IS 'Discount applied during receipt (may differ from PO)';
COMMENT ON COLUMN public.good_receive_note_items.tax IS 'Tax amount for this receipt item';
COMMENT ON COLUMN public.good_receive_note_items.total IS 'Total amount for this receipt item (calculated)'; 