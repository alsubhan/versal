-- Add missing status columns to sales_orders and sale_invoices tables
-- This script adds the status columns that are missing from your database

-- Step 1: Add status column to sales_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_orders' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.sales_orders 
    ADD COLUMN status public.grn_status DEFAULT 'draft';
    
    RAISE NOTICE 'Added status column to sales_orders table';
  ELSE
    RAISE NOTICE 'sales_orders.status column already exists';
  END IF;
END $$;

-- Step 2: Add status column to sale_invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sale_invoices' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.sale_invoices 
    ADD COLUMN status public.invoice_status DEFAULT 'draft';
    
    RAISE NOTICE 'Added status column to sale_invoices table';
  ELSE
    RAISE NOTICE 'sale_invoices.status column already exists';
  END IF;
END $$;

-- Step 3: Create indexes for the new status columns
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sale_invoices_status ON public.sale_invoices(status);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN public.sales_orders.status IS 'Status of the sales order using grn_status enum';
COMMENT ON COLUMN public.sale_invoices.status IS 'Status of the sale invoice using invoice_status enum';

-- Step 5: Verify the changes
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

-- Step 6: Show summary
SELECT 
  'SUCCESS' as status,
  'Missing status columns have been added' as message; 