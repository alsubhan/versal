-- Fix the get_user_role function to work with role_id instead of role
-- The profiles table has role_id column, not role column

-- First, drop all RLS policies that depend on get_user_role function
-- This will find and drop ALL policies that reference the function
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies that reference get_user_role function
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE pg_get_expr(qual, polrelid) LIKE '%get_user_role%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s" ON %s.%s', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
END $$;

-- Now drop the function
DROP FUNCTION IF EXISTS public.get_user_role(user_id UUID);

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.name::user_role 
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$;

-- Recreate all the RLS policies
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin and manager access" ON public.categories
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.categories
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.units
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.units
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.taxes
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.taxes
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.suppliers
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.suppliers
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.customers
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.customers
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.products
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.products
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.stock_levels
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.stock_levels
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

-- Recreate user_settings and system_settings policies
CREATE POLICY "Admins can view all user settings" ON public.user_settings
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Add any other policies that might exist
-- These are common policies that might be missing
CREATE POLICY "Users can manage their own settings" ON public.user_settings
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can read public system settings" ON public.system_settings
  FOR SELECT USING (is_public = true AND auth.uid() IS NOT NULL);

-- Test the function (optional)
-- SELECT public.get_user_role('your-user-id-here'); 