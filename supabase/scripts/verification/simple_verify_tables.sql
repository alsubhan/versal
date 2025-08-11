-- Simple verification script - only checks what exists
-- This won't fail if columns don't exist

-- Check if tables exist
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'DOES NOT EXIST' END as table_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('sales_orders', 'sale_invoices', 'good_receive_notes')
ORDER BY table_name;

-- Check if status columns exist
SELECT 
  'sales_orders' as table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sales_orders'
  AND column_name = 'status'

UNION ALL

SELECT 
  'sale_invoices' as table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sale_invoices'
  AND column_name = 'status'

UNION ALL

SELECT 
  'good_receive_notes' as table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'good_receive_notes'
  AND column_name = 'status';

-- Check if ENUM types exist
SELECT 
  typname as enum_name,
  enumlabel as enum_value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname IN ('grn_status', 'invoice_status', 'order_status')
ORDER BY t.typname, e.enumsortorder;

-- Summary
SELECT 
  'SUMMARY' as info,
  'Run this first to see what exists in your database' as message; 