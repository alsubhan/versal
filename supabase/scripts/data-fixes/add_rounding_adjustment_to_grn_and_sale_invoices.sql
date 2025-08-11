-- Add rounding_adjustment column to good_receive_notes table
ALTER TABLE public.good_receive_notes 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add rounding_adjustment column to sale_invoices table
ALTER TABLE public.sale_invoices 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add comments explaining the purpose of rounding adjustment columns
COMMENT ON COLUMN public.good_receive_notes.rounding_adjustment IS 'Rounding adjustment applied to the total amount for GRN';
COMMENT ON COLUMN public.sale_invoices.rounding_adjustment IS 'Rounding adjustment applied to the total amount for sale invoice'; 