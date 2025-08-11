-- Add vendor invoice number to GRNs and EAN code to GRN items
-- Safe to run multiple times due to IF NOT EXISTS checks

-- Add column vendor_invoice_number to good_receive_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'good_receive_notes'
      AND column_name = 'vendor_invoice_number'
  ) THEN
    ALTER TABLE public.good_receive_notes
      ADD COLUMN vendor_invoice_number TEXT NULL;
  END IF;
END $$;

-- Add column ean_code to good_receive_note_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'good_receive_note_items'
      AND column_name = 'ean_code'
  ) THEN
    ALTER TABLE public.good_receive_note_items
      ADD COLUMN ean_code TEXT NULL;
  END IF;
END $$;

-- Optional helpful index on vendor invoice number for lookups
CREATE INDEX IF NOT EXISTS idx_grn_vendor_invoice_number
  ON public.good_receive_notes (vendor_invoice_number);


