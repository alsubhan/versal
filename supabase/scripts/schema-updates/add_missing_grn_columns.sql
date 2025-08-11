-- Add missing columns to good_receive_notes table
-- These columns are needed for the backend API to work properly

ALTER TABLE public.good_receive_notes 
ADD COLUMN subtotal DECIMAL(12,2) DEFAULT 0,
ADD COLUMN tax_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN total_amount DECIMAL(12,2) DEFAULT 0;

-- Add missing columns to good_receive_note_items table
-- These columns are needed for the backend API to work properly

ALTER TABLE public.good_receive_note_items 
ADD COLUMN discount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN tax DECIMAL(12,2) DEFAULT 0,
ADD COLUMN total DECIMAL(12,2) DEFAULT 0;

-- Add comments for the new columns in good_receive_notes
COMMENT ON COLUMN public.good_receive_notes.subtotal IS 'Subtotal amount before tax and discount';
COMMENT ON COLUMN public.good_receive_notes.tax_amount IS 'Total tax amount';
COMMENT ON COLUMN public.good_receive_notes.discount_amount IS 'Total discount amount';
COMMENT ON COLUMN public.good_receive_notes.total_amount IS 'Final total amount after tax and discount';

-- Add comments for the new columns in good_receive_note_items
COMMENT ON COLUMN public.good_receive_note_items.discount IS 'Discount amount for this item';
COMMENT ON COLUMN public.good_receive_note_items.tax IS 'Tax amount for this item';
COMMENT ON COLUMN public.good_receive_note_items.total IS 'Total amount for this item (quantity * unit_cost - discount + tax)';

-- Verify the changes for good_receive_notes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'good_receive_notes' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify the changes for good_receive_note_items
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'good_receive_note_items' 
AND table_schema = 'public'
ORDER BY ordinal_position; 