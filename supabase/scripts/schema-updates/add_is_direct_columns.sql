-- Migration to add is_direct columns for preserving creation mode
-- This allows us to distinguish between linked and direct creation modes

-- Add sales_order_id column to sale_invoices table (needed for linked creation)
ALTER TABLE public.sale_invoices 
ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.sales_orders(id);

-- Add is_direct column to sale_invoices table
ALTER TABLE public.sale_invoices 
ADD COLUMN IF NOT EXISTS is_direct BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.sale_invoices.sales_order_id IS 'Reference to the sales order this invoice was created against (for linked creation)';
COMMENT ON COLUMN public.sale_invoices.is_direct IS 'Indicates if this invoice was created directly (true) or linked to an existing sales order (false)';

-- Add is_direct column to good_receive_notes table
ALTER TABLE public.good_receive_notes 
ADD COLUMN IF NOT EXISTS is_direct BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.good_receive_notes.is_direct IS 'Indicates if this GRN was created directly (true) or linked to an existing purchase order (false)';

-- Update existing records to set is_direct based on current data
-- For sale_invoices: Since there's no sales_order_id column, all existing records are likely direct
-- We'll set them all to true (direct) as a safe default
UPDATE public.sale_invoices 
SET is_direct = true;

-- For good_receive_notes: if purchase_order_id is NULL, it was likely created directly
-- Note: Currently good_receive_notes.purchase_order_id is NOT NULL, so all existing records will be is_direct = false
-- This is correct since the current schema requires purchase_order_id

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sale_invoices_sales_order_id ON public.sale_invoices(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sale_invoices_is_direct ON public.sale_invoices(is_direct);
CREATE INDEX IF NOT EXISTS idx_good_receive_notes_is_direct ON public.good_receive_notes(is_direct);

-- Verify the changes
SELECT 
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('sale_invoices', 'good_receive_notes')
  AND column_name IN ('is_direct', 'sales_order_id')
ORDER BY table_name, column_name; 