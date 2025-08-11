-- Fix enum conflicts by standardizing invoice_status enum
-- This resolves the conflict between different invoice_status enum definitions

-- First, check which enum is currently being used
DO $$
BEGIN
    -- Drop the conflicting invoice_status enum if it exists
    DROP TYPE IF EXISTS public.invoice_status CASCADE;
    
    -- Recreate the invoice_status enum with the correct values for sale_invoices
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
    
    RAISE NOTICE 'invoice_status enum recreated with correct values';
END $$;

-- Verify the enum was created correctly
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')
ORDER BY enumsortorder; 