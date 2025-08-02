-- Add timestamp columns to roles table
ALTER TABLE public.roles 
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for roles table
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON public.roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing roles to have timestamps (if any exist)
UPDATE public.roles 
SET created_at = NOW(), updated_at = NOW() 
WHERE created_at IS NULL OR updated_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.roles.created_at IS 'Timestamp when the role was created';
COMMENT ON COLUMN public.roles.updated_at IS 'Timestamp when the role was last updated'; 