-- Fix RLS Policy for Roles Table
-- The current admin-only policy is blocking the application from reading role information
-- We need to allow authenticated users to read roles while maintaining admin-only write access

-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admin only access" ON public.roles;

-- Create separate policies for read and write access
-- Allow all authenticated users to read roles (needed for permission checking)
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can modify roles
CREATE POLICY "Admin only write access" ON public.roles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only update access" ON public.roles
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only delete access" ON public.roles
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Verify the policies were created
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
  AND tablename = 'roles'
ORDER BY policyname; 