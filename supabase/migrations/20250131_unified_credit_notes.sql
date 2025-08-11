-- Migration: Unified Credit Notes with Invoice Linking
-- This migration implements Option 2: All credit notes must link to invoices

-- Step 1: Add invoice_id column to credit_notes table
ALTER TABLE public.credit_notes 
ADD COLUMN invoice_id UUID REFERENCES public.sale_invoices(id) ON DELETE SET NULL;

-- Step 2: Add credit_note_type enum to distinguish between invoice-linked and standalone
CREATE TYPE credit_note_type AS ENUM ('invoice_linked', 'standalone');
ALTER TABLE public.credit_notes 
ADD COLUMN credit_note_type credit_note_type NOT NULL DEFAULT 'invoice_linked';

-- Step 3: Update existing credit notes to be invoice_linked if they have sales_order_id
-- (This assumes existing credit notes are linked to sales orders, which represent invoices)
UPDATE public.credit_notes 
SET credit_note_type = 'invoice_linked', 
    invoice_id = (
      SELECT si.id 
      FROM public.sale_invoices si 
      WHERE si.sales_order_id = credit_notes.sales_order_id 
      LIMIT 1
    )
WHERE sales_order_id IS NOT NULL;

-- Step 4: Update remaining credit notes to be standalone
UPDATE public.credit_notes 
SET credit_note_type = 'standalone'
WHERE credit_note_type = 'invoice_linked' AND invoice_id IS NULL;

-- Step 5: NOW add constraint to ensure invoice_id is provided for invoice_linked type
-- (After all existing data has been updated to match the constraint)
ALTER TABLE public.credit_notes 
ADD CONSTRAINT check_invoice_linked_has_invoice 
CHECK (
  (credit_note_type = 'invoice_linked' AND invoice_id IS NOT NULL) OR
  (credit_note_type = 'standalone' AND invoice_id IS NULL)
);

-- Step 6: Create index for invoice_id for better performance
CREATE INDEX idx_credit_notes_invoice_id ON public.credit_notes(invoice_id);

-- Step 7: Add comment to explain the new structure
COMMENT ON COLUMN public.credit_notes.invoice_id IS 'Reference to the sale invoice this credit note relates to. Required for invoice_linked credit notes.';
COMMENT ON COLUMN public.credit_notes.credit_note_type IS 'Type of credit note: invoice_linked (must have invoice_id) or standalone (no invoice reference).';
COMMENT ON CONSTRAINT check_invoice_linked_has_invoice ON public.credit_notes IS 'Ensures invoice_linked credit notes have invoice_id and standalone credit notes do not.';
