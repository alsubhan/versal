-- Diagnostic queries to check the current state
-- Run these one by one to identify issues

-- 1. Check current enum values
SELECT unnest(enum_range(NULL::invoice_status)) as valid_status_values;

-- 2. Check current invoice statuses
SELECT id, invoice_number, status, total_amount 
FROM sale_invoices 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check if there are any invalid status values
SELECT id, invoice_number, status 
FROM sale_invoices 
WHERE status::text NOT IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');

-- 4. Check customer_payments table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'customer_payments' 
ORDER BY ordinal_position;

-- 5. Check if the trigger function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'update_invoice_status_from_payments';

-- 6. Check if the trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_invoice_status';
