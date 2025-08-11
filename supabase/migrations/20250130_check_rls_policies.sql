-- Check for RLS (Row Level Security) policies that might be causing the issue
-- Run these queries to investigate

-- 1. Check if RLS is enabled on the tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('sale_invoices', 'customer_payments');

-- 2. Check RLS policies on sale_invoices table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'sale_invoices';

-- 3. Check RLS policies on customer_payments table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'customer_payments';

-- 4. Check if there are any functions called by RLS policies
SELECT DISTINCT
    p.policyname,
    p.tablename,
    p.qual,
    p.with_check
FROM pg_policies p
WHERE p.tablename IN ('sale_invoices', 'customer_payments')
  AND (p.qual IS NOT NULL OR p.with_check IS NOT NULL);

-- 5. Check for any automatic column updates (like updated_at triggers)
SELECT 
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE action_statement LIKE '%updated_at%'
   OR action_statement LIKE '%NOW()%';
