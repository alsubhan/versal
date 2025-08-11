-- Script to verify table structure and check if status columns exist
-- Run this first to see what we're working with

-- Check if tables exist
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'DOES NOT EXIST' END as table_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('sales_orders', 'sale_invoices', 'good_receive_notes')
ORDER BY table_name;

-- Check column structure for each table
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

-- Check current data in status columns (if they exist)
DO $$
BEGIN
  -- Check sales_orders status data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_orders' 
      AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'sales_orders.status data:';
    FOR r IN SELECT status, COUNT(*) as count FROM sales_orders GROUP BY status LOOP
      RAISE NOTICE '  %: % records', r.status, r.count;
    END LOOP;
  ELSE
    RAISE NOTICE 'sales_orders.status column does not exist';
  END IF;

  -- Check sale_invoices status data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sale_invoices' 
      AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'sale_invoices.status data:';
    FOR r IN SELECT status, COUNT(*) as count FROM sale_invoices GROUP BY status LOOP
      RAISE NOTICE '  %: % records', r.status, r.count;
    END LOOP;
  ELSE
    RAISE NOTICE 'sale_invoices.status column does not exist';
  END IF;

  -- Check good_receive_notes status data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'good_receive_notes' 
      AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'good_receive_notes.status data:';
    FOR r IN SELECT status, COUNT(*) as count FROM good_receive_notes GROUP BY status LOOP
      RAISE NOTICE '  %: % records', r.status, r.count;
    END LOOP;
  ELSE
    RAISE NOTICE 'good_receive_notes.status column does not exist';
  END IF;
END $$; 