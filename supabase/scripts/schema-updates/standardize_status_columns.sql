-- Migration to standardize status columns to use ENUM types
-- This script handles existing ENUM types and proper casting

-- Step 1: Create missing ENUM types (only if they don't exist)
DO $$ 
BEGIN
  -- Create GRN status ENUM if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grn_status') THEN
    CREATE TYPE public.grn_status AS ENUM ('draft', 'partial', 'completed', 'rejected');
  END IF;
  
  -- Create credit note status ENUM if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_note_status') THEN
    CREATE TYPE public.credit_note_status AS ENUM ('draft', 'pending', 'approved', 'processed', 'cancelled');
  END IF;
END $$;

-- Step 2: Drop triggers that depend on status columns
-- Drop credit note approval trigger
DROP TRIGGER IF EXISTS on_credit_note_approval ON public.credit_notes;

-- Drop sale invoice status change trigger
DROP TRIGGER IF EXISTS on_sale_invoice_status_change ON public.sale_invoices;

-- Step 3: Update good_receive_notes table
-- First, remove the CHECK constraint
ALTER TABLE public.good_receive_notes DROP CONSTRAINT IF EXISTS good_receive_notes_status_check;

-- Remove the default value first
ALTER TABLE public.good_receive_notes ALTER COLUMN status DROP DEFAULT;

-- Update the column type
ALTER TABLE public.good_receive_notes 
  ALTER COLUMN status TYPE grn_status USING 
    CASE status
      WHEN 'draft' THEN 'draft'::grn_status
      WHEN 'partial' THEN 'partial'::grn_status
      WHEN 'completed' THEN 'completed'::grn_status
      WHEN 'rejected' THEN 'rejected'::grn_status
      ELSE 'draft'::grn_status
    END;

-- Set the default value after type change
ALTER TABLE public.good_receive_notes ALTER COLUMN status SET DEFAULT 'draft'::grn_status;

-- Step 4: Update sale_invoices table
-- First, remove the CHECK constraint
ALTER TABLE public.sale_invoices DROP CONSTRAINT IF EXISTS sale_invoices_status_check;

-- Remove the default value first
ALTER TABLE public.sale_invoices ALTER COLUMN status DROP DEFAULT;

-- Update the column type - using the actual invoice_status ENUM values
ALTER TABLE public.sale_invoices 
  ALTER COLUMN status TYPE invoice_status USING 
    CASE status
      WHEN 'draft' THEN 'draft'::invoice_status
      WHEN 'sent' THEN 'sent'::invoice_status
      WHEN 'paid' THEN 'paid'::invoice_status
      WHEN 'overdue' THEN 'overdue'::invoice_status
      WHEN 'cancelled' THEN 'cancelled'::invoice_status
      -- Map any other values to 'draft' as fallback
      ELSE 'draft'::invoice_status
    END;

-- Set the default value after type change
ALTER TABLE public.sale_invoices ALTER COLUMN status SET DEFAULT 'draft'::invoice_status;

-- Step 5: Update credit_notes table
-- First, remove the CHECK constraint
ALTER TABLE public.credit_notes DROP CONSTRAINT IF EXISTS credit_notes_status_check;

-- Remove the default value first
ALTER TABLE public.credit_notes ALTER COLUMN status DROP DEFAULT;

-- Update the column type
ALTER TABLE public.credit_notes 
  ALTER COLUMN status TYPE credit_note_status USING 
    CASE status
      WHEN 'draft' THEN 'draft'::credit_note_status
      WHEN 'pending' THEN 'pending'::credit_note_status
      WHEN 'approved' THEN 'approved'::credit_note_status
      WHEN 'processed' THEN 'processed'::credit_note_status
      WHEN 'cancelled' THEN 'cancelled'::credit_note_status
      ELSE 'draft'::credit_note_status
    END;

-- Set the default value after type change
ALTER TABLE public.credit_notes ALTER COLUMN status SET DEFAULT 'draft'::credit_note_status;

-- Step 6: Recreate triggers
-- Recreate credit note approval trigger
CREATE TRIGGER on_credit_note_approval
  AFTER UPDATE ON public.credit_notes
  FOR EACH ROW 
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION public.handle_credit_note_approval();

-- Recreate sale invoice status change trigger (if the function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_sale_invoice_status_change') THEN
    CREATE TRIGGER on_sale_invoice_status_change
      AFTER UPDATE ON public.sale_invoices
      FOR EACH ROW 
      WHEN (OLD.status IS DISTINCT FROM NEW.status)
      EXECUTE FUNCTION public.handle_sale_invoice_status_change();
  END IF;
END $$;

-- Step 7: Verify the changes
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('purchase_orders', 'good_receive_notes', 'sale_invoices', 'credit_notes')
  AND column_name = 'status'
ORDER BY table_name; 