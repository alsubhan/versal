-- Final Schema Reconciliation Migration
-- Adds all missing columns across sales tables to bring the database
-- in sync with the current application backend code.

-- ==================== SALES ORDERS ====================
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
  ADD COLUMN IF NOT EXISTS billing_address    JSONB,
  ADD COLUMN IF NOT EXISTS shipping_address   JSONB;

-- ==================== SALE INVOICES ====================
ALTER TABLE public.sale_invoices
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
  ADD COLUMN IF NOT EXISTS billing_address    JSONB,
  ADD COLUMN IF NOT EXISTS shipping_address   JSONB;

-- ==================== SALE QUOTATIONS ====================
ALTER TABLE public.sale_quotations
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
  ADD COLUMN IF NOT EXISTS billing_address    JSONB,
  ADD COLUMN IF NOT EXISTS shipping_address   JSONB;

-- ==================== BACKFILL ADDRESS SNAPSHOTS FROM CUSTOMERS ====================
-- sales_orders
UPDATE public.sales_orders so
SET
  billing_address  = c.billing_address,
  shipping_address = c.shipping_address
FROM public.customers c
WHERE so.customer_id = c.id
  AND (so.billing_address IS NULL OR so.shipping_address IS NULL);

-- sale_invoices
UPDATE public.sale_invoices si
SET
  billing_address  = c.billing_address,
  shipping_address = c.shipping_address
FROM public.customers c
WHERE si.customer_id = c.id
  AND (si.billing_address IS NULL OR si.shipping_address IS NULL);

-- ==================== NOTIFY POSTGREST TO RELOAD SCHEMA CACHE ====================
NOTIFY pgrst, 'reload schema';
