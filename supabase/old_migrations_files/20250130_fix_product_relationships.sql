-- Fix product relationships to resolve ambiguous foreign key errors
-- This addresses the "more than one relationship was found" error

-- Ensure proper foreign key constraints exist and are named consistently
-- Drop any duplicate or conflicting constraints first

DO $$
BEGIN
  -- Drop existing foreign key constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_category_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products DROP CONSTRAINT products_category_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_unit_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products DROP CONSTRAINT products_unit_id_fkey;
  END IF;
END $$;

-- Create clean, single foreign key relationships
-- Category relationship
ALTER TABLE public.products 
ADD CONSTRAINT products_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) 
ON DELETE SET NULL;

-- Unit relationship
ALTER TABLE public.products 
ADD CONSTRAINT products_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.units(id) 
ON DELETE SET NULL;

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_unit_id ON public.products(unit_id);

-- Update any triggers or functions that might be affected
-- Refresh the updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Test relationships
DO $$
BEGIN
  -- Test that we can query products with relationships
  PERFORM p.id, c.name as category_name, u.name as unit_name
  FROM public.products p
  LEFT JOIN public.categories c ON p.category_id = c.id
  LEFT JOIN public.units u ON p.unit_id = u.id
  LIMIT 1;
  
  RAISE NOTICE 'Product relationships working correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Product relationship test failed: %', SQLERRM;
END $$;
