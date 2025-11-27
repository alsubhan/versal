-- Check what the update_invoice_payment_amounts function does
-- This function is being called by triggers and might be causing the status update issue

-- 1. Check the function definition
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'update_invoice_payment_amounts';

-- 2. Check if this function exists in pg_proc
SELECT 
    proname,
    prosrc
FROM pg_proc 
WHERE proname = 'update_invoice_payment_amounts';

-- 3. Check the function parameters and return type
SELECT 
    p.proname,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
WHERE p.proname = 'update_invoice_payment_amounts';
