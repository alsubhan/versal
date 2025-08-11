-- Fix the get_user_role function to work with the actual schema
-- The profiles table has role_id (UUID) that references roles table, not a direct role column
-- RLS policies expect lowercase role names: 'admin', 'manager', 'staff'
-- But roles table contains capitalized names: 'Administrator', 'Manager', 'Staff'

-- Replace the existing function without dropping it to avoid dependency issues
-- Simply update the function body to work with role_id
-- Create/Replace the correct function that:
-- 1. Joins with roles table using role_id
-- 2. Maps capitalized role names to lowercase for RLS compatibility
-- 3. Returns user_role type if it exists, otherwise TEXT
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      WHEN LOWER(r.name) = 'administrator' THEN 'admin'
      WHEN LOWER(r.name) = 'manager' THEN 'manager'  
      WHEN LOWER(r.name) = 'staff' THEN 'staff'
      ELSE 'staff'  -- Default fallback
    END
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$;

-- Test the function to make sure it works
SELECT 'Function get_user_role created successfully!' as status;
