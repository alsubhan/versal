-- Check all triggers in the database to see if any might be causing the issue
-- Run these queries to investigate

-- 1. List all triggers in the database
SELECT 
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
ORDER BY event_object_table, trigger_name;

-- 2. Check if there are any triggers on customer_payments table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'customer_payments';

-- 3. Check if there are any functions that might be called by triggers
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%invoice%' 
   OR routine_name LIKE '%payment%'
   OR routine_name LIKE '%status%';

-- 4. Check if there are any views that might be causing issues
SELECT 
    table_name,
    view_definition
FROM information_schema.views 
WHERE table_name LIKE '%invoice%' 
   OR table_name LIKE '%payment%';

-- 5. Check if there are any materialized views
SELECT 
    matviewname,
    definition
FROM pg_matviews 
WHERE matviewname LIKE '%invoice%' 
   OR matviewname LIKE '%payment%';
