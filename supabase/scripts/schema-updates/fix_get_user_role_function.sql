-- QUICK FIX: Run this SQL directly in your Supabase SQL Editor
-- This fixes the get_user_role function to work with your actual schema

-- Drop any existing versions of the function
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
DROP FUNCTION IF EXISTS public.get_user_role(user_id UUID);

-- Create the corrected function that works with your schema
-- profiles.role_id -> roles.id -> roles.name
-- Maps 'Administrator' -> 'admin', 'Manager' -> 'manager', 'Staff' -> 'staff'
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
      ELSE 'staff'  -- Default fallback for any other roles
    END
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$;

-- Test the function
DO $$
DECLARE
  test_result TEXT;
BEGIN
  -- Test with a non-existent user (should return NULL)
  SELECT public.get_user_role('00000000-0000-0000-0000-000000000000'::UUID) INTO test_result;
  
  RAISE NOTICE 'Function test completed. Result for non-existent user: %', COALESCE(test_result, 'NULL');
  RAISE NOTICE 'Function get_user_role has been successfully updated!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Function update failed: %', SQLERRM;
END $$;
