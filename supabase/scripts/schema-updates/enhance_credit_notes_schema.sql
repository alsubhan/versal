-- Enhance credit_notes and credit_note_items tables with missing fields
-- This migration adds rounding_adjustment to credit_notes and product snapshot fields to credit_note_items

-- Add rounding_adjustment column to credit_notes table
ALTER TABLE public.credit_notes 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add product snapshot columns to credit_note_items table (for historical accuracy and performance)
ALTER TABLE public.credit_note_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT;

-- Add audit trail field to credit_note_items table
ALTER TABLE public.credit_note_items 
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_note_items_created_by ON public.credit_note_items(created_by);

-- Add comments explaining the purpose of new columns
COMMENT ON COLUMN public.credit_notes.rounding_adjustment IS 'Rounding adjustment applied to the total amount for credit note';
COMMENT ON COLUMN public.credit_note_items.product_name IS 'Product name at time of credit note (for historical accuracy)';
COMMENT ON COLUMN public.credit_note_items.sku_code IS 'Product SKU at time of credit note (for historical accuracy)';
COMMENT ON COLUMN public.credit_note_items.hsn_code IS 'Product HSN code at time of credit note (for historical accuracy)';
COMMENT ON COLUMN public.credit_note_items.sale_tax_type IS 'Tax type (inclusive/exclusive) at time of credit note';
COMMENT ON COLUMN public.credit_note_items.unit_abbreviation IS 'Unit abbreviation at time of credit note';
COMMENT ON COLUMN public.credit_note_items.created_by IS 'User who created the credit note item'; 