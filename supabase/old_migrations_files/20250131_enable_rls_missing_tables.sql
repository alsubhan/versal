-- Enable RLS for Missing Tables
-- This migration enables Row Level Security for tables that were previously RLS disabled

-- Enable RLS on inventory_movements table
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Enable RLS on locations table
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sale_invoices table
ALTER TABLE public.sale_invoices ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sale_invoice_items table
ALTER TABLE public.sale_invoice_items ENABLE ROW LEVEL SECURITY;

-- Check if roles table exists and enable RLS if it does
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
    ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Note: user_roles is a view, so RLS is handled by the underlying tables

-- Create RLS Policies for inventory_movements (follows same pattern as inventory_transactions)
CREATE POLICY "All authenticated users access" ON public.inventory_movements
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS Policies for locations (admin and manager access, staff read access)
CREATE POLICY "Admin and manager access" ON public.locations
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.locations
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

-- Create RLS Policies for sale_invoices (all authenticated users access)
CREATE POLICY "All authenticated users access" ON public.sale_invoices
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS Policies for sale_invoice_items (all authenticated users access)
CREATE POLICY "All authenticated users access" ON public.sale_invoice_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS Policies for roles table (authenticated users can read, admin only write)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
    -- Allow all authenticated users to read roles (needed for permission checking)
    EXECUTE 'CREATE POLICY "Authenticated users can read roles" ON public.roles FOR SELECT USING (auth.uid() IS NOT NULL)';
    
    -- Only admins can modify roles
    EXECUTE 'CREATE POLICY "Admin only insert access" ON public.roles FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = ''admin'')';
    EXECUTE 'CREATE POLICY "Admin only update access" ON public.roles FOR UPDATE USING (public.get_user_role(auth.uid()) = ''admin'')';
    EXECUTE 'CREATE POLICY "Admin only delete access" ON public.roles FOR DELETE USING (public.get_user_role(auth.uid()) = ''admin'')';
  END IF;
END $$;

-- Note: user_roles is a view, so RLS policies are inherited from underlying tables

-- Verify RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename;

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename, policyname; 