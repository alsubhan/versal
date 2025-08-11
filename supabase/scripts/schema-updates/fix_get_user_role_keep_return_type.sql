-- SAFE FIX: Keep the existing return type to avoid conflicts
-- First, let's check what return type the function currently has

-- Option 1: If the function returns user_role enum type
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      WHEN LOWER(r.name) = 'administrator' THEN 'admin'::user_role
      WHEN LOWER(r.name) = 'manager' THEN 'manager'::user_role
      WHEN LOWER(r.name) = 'staff' THEN 'staff'::user_role
      ELSE 'staff'::user_role  -- Default fallback
    END
  FROM public.profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$;

-- Test the function
SELECT 'Function updated with user_role return type!' as status;
