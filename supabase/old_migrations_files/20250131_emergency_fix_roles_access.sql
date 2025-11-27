-- Emergency Fix: Allow Authenticated Users to Read Roles Table
-- This fixes the application spinning issue after RLS was enabled

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admin only access" ON public.roles;

-- Create a policy that allows all authenticated users to read roles
-- This is needed for the application to fetch user permissions
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create separate policies for write operations (admin only)
CREATE POLICY "Admin only insert access" ON public.roles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only update access" ON public.roles
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only delete access" ON public.roles
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Verify the fix
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'roles'
ORDER BY policyname; 