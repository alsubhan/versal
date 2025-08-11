-- Check for any database rules or constraints that might be updating invoice status
-- Run these queries to investigate the issue

-- 1. Check if there are any RULES on the sale_invoices table
SELECT schemaname, tablename, rulename, definition 
FROM pg_rules 
WHERE tablename = 'sale_invoices';

-- 2. Check if there are any TRIGGERS on the sale_invoices table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'sale_invoices';

-- 3. Check if there are any foreign key constraints that might cascade updates
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND (tc.table_name = 'sale_invoices' OR ccu.table_name = 'sale_invoices');

-- 4. Check if there are any CHECK constraints on the status column
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'sale_invoices' 
    AND constraint_type = 'CHECK'
);

-- 5. Check the exact data type of the status column
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sale_invoices' 
AND column_name = 'status';
