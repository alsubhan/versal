-- Migration: Ensure profile creation trigger for auth.users
-- This trigger automatically creates a profile entry in the profiles table
-- whenever a new user is created in auth.users

-- Drop existing trigger if it exists (to allow re-running this migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    role_uuid UUID;
BEGIN
    -- Try to find the role_id based on the role name from user metadata
    -- This allows setting a role during signup via metadata
    IF NEW.raw_user_meta_data ? 'role' THEN
        SELECT id INTO role_uuid 
        FROM public.roles 
        WHERE name = NEW.raw_user_meta_data->>'role'
        LIMIT 1;
    END IF;

    -- Insert into profiles table with user information
    -- Uses metadata if available, otherwise falls back to email-based defaults
    INSERT INTO public.profiles (
        id, 
        username, 
        full_name, 
        is_active,
        role_id
    ) VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'username', 
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'full_name', 
            NEW.email
        ),
        true,
        role_uuid
    );
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- If profile already exists, just return (idempotent)
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't fail the user creation
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Create the trigger that fires after a new user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 
    'Automatically creates a profile entry in the profiles table when a new user is created in auth.users';

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
    'Trigger that fires after user creation to automatically create a corresponding profile';

