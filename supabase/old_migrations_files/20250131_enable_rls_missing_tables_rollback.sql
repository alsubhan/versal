-- Rollback: Disable RLS for Missing Tables
-- This migration can be used to rollback the RLS changes if needed

-- Drop policies first
DROP POLICY IF EXISTS "All authenticated users access" ON public.inventory_movements;
DROP POLICY IF EXISTS "Admin and manager access" ON public.locations;
DROP POLICY IF EXISTS "Staff read access" ON public.locations;
DROP POLICY IF EXISTS "All authenticated users access" ON public.sale_invoices;
DROP POLICY IF EXISTS "All authenticated users access" ON public.sale_invoice_items;
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Admin only insert access" ON public.roles;
DROP POLICY IF EXISTS "Admin only update access" ON public.roles;
DROP POLICY IF EXISTS "Admin only delete access" ON public.roles;
-- Note: user_roles is a view, so no policy to drop

-- Disable RLS on tables
ALTER TABLE public.inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_invoice_items DISABLE ROW LEVEL SECURITY;

-- Check if roles table exists and disable RLS if it does
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
    ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Note: user_roles is a view, so RLS is handled by underlying tables

-- Verify RLS is disabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename; 