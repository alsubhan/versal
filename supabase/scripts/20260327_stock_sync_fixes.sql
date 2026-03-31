-- Database Sync Fixes for Outbound & Inbound testing
-- Created: 2026-03-27

-- 1. Add missing current_stock column to products table if not exists
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS current_stock integer DEFAULT 0;

-- 2. Add location_id to products if needed by inbound API fallback logic
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);

-- 3. Ensure service_role has necessary permissions to bypass RLS on baseline tables
-- This fixes 404 proxy errors in PostgREST when querying through the Python backend using SUPABASE_SERVICE_KEY
GRANT ALL PRIVILEGES ON TABLE public.suppliers TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.suppliers TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.suppliers TO anon;

GRANT ALL PRIVILEGES ON TABLE public.sale_invoices TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.sale_invoices TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.sale_invoices TO anon;

GRANT ALL PRIVILEGES ON TABLE public.customers TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.customers TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.customers TO anon;

GRANT ALL PRIVILEGES ON TABLE public.purchase_orders TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.purchase_orders TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.purchase_orders TO anon;

GRANT ALL PRIVILEGES ON TABLE public.sale_invoice_items TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.sale_invoice_items TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.sale_invoice_items TO anon;
