-- Check and fix stock_levels table schema
-- This script addresses the created_by NOT NULL constraint issue

-- First, let's check the current schema of stock_levels table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stock_levels' 
ORDER BY ordinal_position;

-- Check if created_by has a NOT NULL constraint
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'stock_levels' 
    AND kcu.column_name = 'created_by';

-- Option 1: Make created_by nullable for updates (recommended)
-- This allows updates without changing the original creator
ALTER TABLE public.stock_levels 
ALTER COLUMN created_by DROP NOT NULL;

-- Option 2: Add a trigger to preserve created_by on updates
-- This keeps the original creator and prevents updates from changing it
CREATE OR REPLACE FUNCTION public.preserve_created_by()
RETURNS TRIGGER AS $$
BEGIN
    -- Preserve the original created_by value on updates
    IF TG_OP = 'UPDATE' THEN
        NEW.created_by = OLD.created_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to preserve created_by
DROP TRIGGER IF EXISTS preserve_created_by_trigger ON public.stock_levels;
CREATE TRIGGER preserve_created_by_trigger
    BEFORE UPDATE ON public.stock_levels
    FOR EACH ROW EXECUTE FUNCTION public.preserve_created_by();

-- Verify the changes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stock_levels' 
    AND column_name = 'created_by'; 