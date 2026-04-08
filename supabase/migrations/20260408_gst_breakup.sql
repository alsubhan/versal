-- GST Breakup Migration
-- Adds gst_type, cgst_amount, sgst_amount, igst_amount to sale and purchase documents
-- Also adds company_gstin system setting

-- ==================== SALE INVOICES ====================
ALTER TABLE public.sale_invoices
  ADD COLUMN IF NOT EXISTS gst_type       TEXT NOT NULL DEFAULT 'CGST_SGST',
  ADD COLUMN IF NOT EXISTS cgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- ==================== SALES ORDERS ====================
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS gst_type       TEXT NOT NULL DEFAULT 'CGST_SGST',
  ADD COLUMN IF NOT EXISTS cgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- ==================== SALE QUOTATIONS ====================
ALTER TABLE public.sale_quotations
  ADD COLUMN IF NOT EXISTS gst_type       TEXT NOT NULL DEFAULT 'CGST_SGST',
  ADD COLUMN IF NOT EXISTS cgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- ==================== PURCHASE ORDERS ====================
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS gst_type       TEXT NOT NULL DEFAULT 'CGST_SGST',
  ADD COLUMN IF NOT EXISTS cgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- ==================== GOOD RECEIVE NOTES ====================
ALTER TABLE public.good_receive_notes
  ADD COLUMN IF NOT EXISTS gst_type       TEXT NOT NULL DEFAULT 'CGST_SGST',
  ADD COLUMN IF NOT EXISTS cgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount    NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- ==================== COMPANY GSTIN SETTING ====================
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES ('company_gstin', '""', 'string', 'Company GSTIN number for tax invoices', true)
ON CONFLICT (setting_key) DO NOTHING;
