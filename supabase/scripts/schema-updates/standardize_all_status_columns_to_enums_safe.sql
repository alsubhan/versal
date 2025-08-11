-- Safe Migration to standardize all status columns to use ENUM types
-- This script will:
-- 1. Check if tables and columns exist before attempting changes
-- 2. Create/update ENUM types with correct values
-- 3. Convert TEXT status columns to ENUM types only if they exist
-- 4. Handle existing data safely

-- Step 1: Create/Update ENUM types with correct values
DO $$ 
BEGIN
  -- Create/Update grn_status enum for good_receive_notes and sales_orders
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grn_status') THEN
    CREATE TYPE public.grn_status AS ENUM ('draft', 'partial', 'completed', 'rejected');
  ELSE
    -- Drop and recreate if it exists with wrong values
    DROP TYPE public.grn_status CASCADE;
    CREATE TYPE public.grn_status AS ENUM ('draft', 'partial', 'completed', 'rejected');
  END IF;
END $$;

DO $$ 
BEGIN
  -- Create/Update invoice_status enum for sale_invoices (narrower set)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
  ELSE
    -- Drop and recreate if it exists with wrong values
    DROP TYPE public.invoice_status CASCADE;
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
  END IF;
END $$;

-- Step 2: Drop existing triggers that depend on status columns (only if they exist)
DROP TRIGGER IF EXISTS on_sales_order_status_change ON public.sales_orders;
DROP TRIGGER IF EXISTS on_sale_invoice_status_change ON public.sale_invoices;
DROP TRIGGER IF EXISTS on_grn_item_change ON public.good_receive_note_items;

-- Step 3: Convert good_receive_notes status column to grn_status enum (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'good_receive_notes' 
      AND column_name = 'status'
  ) THEN
    -- Drop constraint if it exists
    ALTER TABLE public.good_receive_notes 
    DROP CONSTRAINT IF EXISTS good_receive_notes_status_check;

    -- Convert column type
    ALTER TABLE public.good_receive_notes 
    ALTER COLUMN status TYPE public.grn_status 
    USING CASE 
      WHEN status = 'draft' THEN 'draft'::public.grn_status
      WHEN status = 'partial' THEN 'partial'::public.grn_status
      WHEN status = 'completed' THEN 'completed'::public.grn_status
      WHEN status = 'rejected' THEN 'rejected'::public.grn_status
      ELSE 'draft'::public.grn_status
    END;

    ALTER TABLE public.good_receive_notes 
    ALTER COLUMN status SET DEFAULT 'draft';
    
    RAISE NOTICE 'Converted good_receive_notes.status to grn_status enum';
  ELSE
    RAISE NOTICE 'good_receive_notes.status column does not exist - skipping';
  END IF;
END $$;

-- Step 4: Convert sale_invoices status column to invoice_status enum (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sale_invoices' 
      AND column_name = 'status'
  ) THEN
    -- Drop constraint if it exists
    ALTER TABLE public.sale_invoices 
    DROP CONSTRAINT IF EXISTS sale_invoices_status_check;

    -- Convert column type
    ALTER TABLE public.sale_invoices 
    ALTER COLUMN status TYPE public.invoice_status 
    USING CASE 
      WHEN status = 'draft' THEN 'draft'::public.invoice_status
      WHEN status = 'sent' THEN 'sent'::public.invoice_status
      WHEN status = 'paid' THEN 'paid'::public.invoice_status
      WHEN status = 'overdue' THEN 'overdue'::public.invoice_status
      WHEN status = 'cancelled' THEN 'cancelled'::public.invoice_status
      WHEN status = 'pending' THEN 'sent'::public.invoice_status  -- Map 'pending' to 'sent'
      ELSE 'draft'::public.invoice_status
    END;

    ALTER TABLE public.sale_invoices 
    ALTER COLUMN status SET DEFAULT 'draft';
    
    RAISE NOTICE 'Converted sale_invoices.status to invoice_status enum';
  ELSE
    RAISE NOTICE 'sale_invoices.status column does not exist - skipping';
  END IF;
END $$;

-- Step 5: Convert sales_orders status column to grn_status enum (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'sales_orders' 
      AND column_name = 'status'
  ) THEN
    -- Convert column type
    ALTER TABLE public.sales_orders 
    ALTER COLUMN status TYPE public.grn_status 
    USING CASE 
      WHEN status = 'draft' THEN 'draft'::public.grn_status
      WHEN status = 'pending' THEN 'partial'::public.grn_status  -- Map 'pending' to 'partial'
      WHEN status = 'approved' THEN 'completed'::public.grn_status  -- Map 'approved' to 'completed'
      WHEN status = 'received' THEN 'completed'::public.grn_status  -- Map 'received' to 'completed'
      WHEN status = 'cancelled' THEN 'rejected'::public.grn_status  -- Map 'cancelled' to 'rejected'
      ELSE 'draft'::public.grn_status
    END;

    ALTER TABLE public.sales_orders 
    ALTER COLUMN status SET DEFAULT 'draft';
    
    RAISE NOTICE 'Converted sales_orders.status to grn_status enum';
  ELSE
    RAISE NOTICE 'sales_orders.status column does not exist - skipping';
  END IF;
END $$;

-- Step 6: Recreate triggers (only if tables exist)
-- Recreate sales order inventory trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_orders') THEN
    CREATE OR REPLACE FUNCTION public.handle_sales_order_inventory()
    RETURNS TRIGGER AS $$
    BEGIN
      -- When sales order status changes to 'completed' (approved/received)
      IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
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
        
      -- When sales order is rejected (cancelled), reverse the inventory transaction
      ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        
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
      
    RAISE NOTICE 'Recreated sales order inventory trigger';
  ELSE
    RAISE NOTICE 'sales_orders table does not exist - skipping trigger creation';
  END IF;
END $$;

-- Recreate sale invoice inventory trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_invoices') THEN
    CREATE OR REPLACE FUNCTION public.handle_sale_invoice_inventory()
    RETURNS TRIGGER AS $$
    BEGIN
      -- When sale invoice status changes to 'paid'
      IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
        
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
          sii.product_id,
          'sale',
          -sii.quantity, -- Negative for sales (reduces inventory)
          'sale_invoice',
          NEW.id,
          'Sale Invoice: ' || NEW.invoice_number || ' - Status: ' || NEW.status,
          COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1))
        FROM public.sale_invoice_items sii
        WHERE sii.invoice_id = NEW.id;
        
      -- When sale invoice is cancelled, reverse the inventory transaction
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
          sii.product_id,
          'sale',
          sii.quantity, -- Positive to reverse the negative sale
          'sale_invoice',
          NEW.id,
          'Sale Invoice Cancelled: ' || NEW.invoice_number || ' - Status: ' || NEW.status,
          COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1))
        FROM public.sale_invoice_items sii
        WHERE sii.invoice_id = NEW.id;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER on_sale_invoice_status_change
      AFTER UPDATE ON public.sale_invoices
      FOR EACH ROW EXECUTE FUNCTION public.handle_sale_invoice_inventory();
      
    RAISE NOTICE 'Recreated sale invoice inventory trigger';
  ELSE
    RAISE NOTICE 'sale_invoices table does not exist - skipping trigger creation';
  END IF;
END $$;

-- Recreate GRN inventory trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'good_receive_notes') THEN
    CREATE OR REPLACE FUNCTION public.handle_grn_inventory_update()
    RETURNS TRIGGER AS $$
    BEGIN
      -- When GRN status changes to 'completed'
      IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
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
          grni.product_id,
          'purchase',
          grni.accepted_quantity, -- Positive for purchases (increases inventory)
          'good_receive_note',
          NEW.id,
          'GRN: ' || NEW.grn_number || ' - Status: ' || NEW.status,
          COALESCE(NEW.received_by, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1))
        FROM public.good_receive_note_items grni
        WHERE grni.grn_id = NEW.id;
        
      -- When GRN is rejected, reverse the inventory transaction
      ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        
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
          grni.product_id,
          'purchase',
          -grni.accepted_quantity, -- Negative to reverse the positive purchase
          'good_receive_note',
          NEW.id,
          'GRN Rejected: ' || NEW.grn_number || ' - Status: ' || NEW.status,
          COALESCE(NEW.received_by, (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1))
        FROM public.good_receive_note_items grni
        WHERE grni.grn_id = NEW.id;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER on_grn_status_change
      AFTER UPDATE ON public.good_receive_notes
      FOR EACH ROW EXECUTE FUNCTION public.handle_grn_inventory_update();
      
    RAISE NOTICE 'Recreated GRN inventory trigger';
  ELSE
    RAISE NOTICE 'good_receive_notes table does not exist - skipping trigger creation';
  END IF;
END $$;

-- Step 7: Update indexes (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_orders') THEN
    CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_invoices') THEN
    CREATE INDEX IF NOT EXISTS idx_sale_invoices_status ON public.sale_invoices(status);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'good_receive_notes') THEN
    CREATE INDEX IF NOT EXISTS idx_good_receive_notes_status ON public.good_receive_notes(status);
  END IF;
END $$;

-- Step 8: Add comments for documentation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'status') THEN
    COMMENT ON COLUMN public.sales_orders.status IS 'Status of the sales order using grn_status enum';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_invoices' AND column_name = 'status') THEN
    COMMENT ON COLUMN public.sale_invoices.status IS 'Status of the sale invoice using invoice_status enum';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'good_receive_notes' AND column_name = 'status') THEN
    COMMENT ON COLUMN public.good_receive_notes.status IS 'Status of the good receive note using grn_status enum';
  END IF;
END $$;

-- Step 9: Final verification
SELECT 
  'Migration completed successfully' as status,
  'Check the NOTICE messages above for details' as details; 