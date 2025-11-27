-- Fix the handle_new_user trigger function to use role_id instead of role
-- The profiles table has role_id column, not role column

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    role_uuid UUID;
BEGIN
    -- Try to find the role_id based on the role name from user metadata
    IF NEW.raw_user_meta_data ? 'role' THEN
        SELECT id INTO role_uuid 
        FROM public.roles 
        WHERE name = NEW.raw_user_meta_data->>'role';
    END IF;

    -- Insert into profiles table with correct column names
    INSERT INTO public.profiles (
        id, 
        username, 
        full_name, 
        is_active,
        role_id
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        true,
        role_uuid
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Test the function (optional)
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created'; 