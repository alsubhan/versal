-- Fix Sales Order Status Enum Mismatch
-- This script creates so_status enum and updates sales_orders table to use it

-- Step 1: Create so_status enum for sales orders
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'so_status') THEN
    CREATE TYPE public.so_status AS ENUM ('draft', 'pending', 'approved', 'sent', 'paid', 'overdue', 'cancelled');
  ELSE
    -- Drop and recreate if it exists with wrong values
    DROP TYPE public.so_status CASCADE;
    CREATE TYPE public.so_status AS ENUM ('draft', 'pending', 'approved', 'sent', 'paid', 'overdue', 'cancelled');
  END IF;
END $$;

-- Step 2: Drop existing triggers that depend on sales_orders status
DROP TRIGGER IF EXISTS on_sales_order_status_change ON public.sales_orders;

-- Step 3: Convert sales_orders status column from grn_status to so_status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_orders' 
      AND column_name = 'status'
  ) THEN
    -- First, remove the default value
    ALTER TABLE public.sales_orders 
    ALTER COLUMN status DROP DEFAULT;
    
    -- Convert column type from grn_status to so_status
    ALTER TABLE public.sales_orders 
    ALTER COLUMN status TYPE public.so_status 
    USING CASE 
      WHEN status = 'draft' THEN 'draft'::public.so_status
      WHEN status = 'partial' THEN 'pending'::public.so_status  -- Map 'partial' to 'pending'
      WHEN status = 'completed' THEN 'approved'::public.so_status  -- Map 'completed' to 'approved'
      WHEN status = 'rejected' THEN 'cancelled'::public.so_status  -- Map 'rejected' to 'cancelled'
      ELSE 'draft'::public.so_status
    END;

    -- Set the new default value
    ALTER TABLE public.sales_orders 
    ALTER COLUMN status SET DEFAULT 'draft';
    
    RAISE NOTICE 'Converted sales_orders.status from grn_status to so_status enum';
  ELSE
    RAISE NOTICE 'sales_orders.status column does not exist - skipping';
  END IF;
END $$;

-- Step 4: Recreate sales order inventory trigger with correct status values
CREATE OR REPLACE FUNCTION public.handle_sales_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When sales order status changes to 'approved' or 'sent'
  IF NEW.status IN ('approved', 'sent') AND OLD.status NOT IN ('approved', 'sent') THEN
    
    -- Create inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      soi.product_id,
      'sale',
      -soi.quantity, -- Negative for sales (reduces inventory)
      'sales_order',
      NEW.id,
      'Sales Order: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
    
  -- When sales order is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    SELECT 
      soi.product_id,
      'sale',
      soi.quantity, -- Positive to reverse the negative sale
      'sales_order',
      NEW.id,
      'Sales Order Cancelled: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sales_order_status_change
  AFTER UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_order_inventory();

-- Step 5: Update index
DROP INDEX IF EXISTS idx_sales_orders_status;
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);

-- Step 6: Add comment for documentation
COMMENT ON COLUMN public.sales_orders.status IS 'Status of the sales order using so_status enum';

-- Step 7: Verify the changes
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
  AND column_name = 'status';

-- Step 8: Show all ENUM types for reference
SELECT 
  typname as enum_name,
  enumlabel as enum_value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname IN ('order_status', 'grn_status', 'so_status', 'invoice_status')
ORDER BY t.typname, e.enumsortorder;

-- Step 9: Show summary
SELECT 
  'SUCCESS' as status,
  'Sales order status enum has been fixed' as message; 