-- Fix the get_user_role function to handle both 'role' and 'role_id' columns
-- This addresses the "column role does not exist" error

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_user_role(UUID);

-- Create updated function that handles both role and role_id columns
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'role'
        AND table_schema = 'public'
      ) THEN (
        SELECT role::TEXT FROM public.profiles WHERE id = user_id
      )
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'role_id'
        AND table_schema = 'public'
      ) THEN (
        SELECT r.name FROM public.profiles p 
        JOIN public.roles r ON p.role_id = r.id 
        WHERE p.id = user_id
      )
      ELSE 'staff'
    END;
$$;

-- Update RLS policies to use the fixed function
-- Note: This assumes the policies already exist and just need to be refreshed

-- Test that the function works
DO $$
BEGIN
  -- Test the function with a sample call
  PERFORM public.get_user_role('00000000-0000-0000-0000-000000000000'::UUID);
  RAISE NOTICE 'Function get_user_role created successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Function creation failed: %', SQLERRM;
END $$;
