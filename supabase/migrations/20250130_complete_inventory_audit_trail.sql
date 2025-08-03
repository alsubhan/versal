-- Complete Inventory Audit Trail Migration
-- This migration implements comprehensive inventory tracking across all modules

-- Create sale invoices table for wholesale billing functionality
CREATE TABLE IF NOT EXISTS public.sale_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'online', 'credit', 'credit_note')),
  payment_reference TEXT,
  payment_date DATE,
  credit_note_id UUID,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_due DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  affects_inventory BOOLEAN DEFAULT true,
  inventory_processed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sale invoice items table
CREATE TABLE IF NOT EXISTS public.sale_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.sale_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount + tax) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transaction type enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM ('purchase', 'sale', 'adjustment', 'return', 'transfer');
  END IF;
END $$;

-- Create invoice status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'paid', 'overdue', 'cancelled', 'returned', 'exchanged', 'partially_returned');
  END IF;
END $$;

-- Function to handle sales order inventory updates
CREATE OR REPLACE FUNCTION public.handle_sales_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When sales order status changes to 'confirmed', 'processing', or 'shipped'
  IF NEW.status IN ('confirmed', 'processing', 'shipped') AND 
     OLD.status NOT IN ('confirmed', 'processing', 'shipped') THEN
    
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
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
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
      'adjustment',
      soi.quantity, -- Positive to restore inventory
      'sales_order',
      NEW.id,
      'Order Cancelled - Inventory Restored: ' || NEW.order_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for sales order inventory updates
CREATE TRIGGER on_sales_order_status_change
  AFTER UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_order_inventory();

-- Function to handle sale invoice inventory updates
CREATE OR REPLACE FUNCTION public.handle_sale_invoice_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When sale invoice status changes to 'paid' or 'processing'
  IF NEW.status IN ('paid', 'processing') AND 
     OLD.status NOT IN ('paid', 'processing') THEN
    
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
      'Sale via Invoice: ' || NEW.invoice_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
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
      'adjustment',
      sii.quantity, -- Positive to restore inventory
      'sale_invoice',
      NEW.id,
      'Invoice Cancelled - Inventory Restored: ' || NEW.invoice_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sale_invoice_items sii
    WHERE sii.invoice_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for sale invoice inventory updates
CREATE TRIGGER on_sale_invoice_status_change
  AFTER UPDATE ON public.sale_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_invoice_inventory();

-- Function to handle purchase order inventory transactions
CREATE OR REPLACE FUNCTION public.handle_purchase_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When purchase order status changes to 'confirmed' or 'processing'
  IF NEW.status IN ('confirmed', 'processing') AND 
     OLD.status NOT IN ('confirmed', 'processing') THEN
    
    -- Create inventory transaction for each item (reserved inventory)
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
      poi.product_id,
      'purchase',
      poi.quantity, -- Positive for purchases (increases inventory)
      'purchase_order',
      NEW.id,
      'Purchase via Order: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id;
    
  -- When purchase order is cancelled, reverse the inventory transaction
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
      poi.product_id,
      'adjustment',
      -poi.quantity, -- Negative to reverse the purchase
      'purchase_order',
      NEW.id,
      'Order Cancelled - Inventory Reversed: ' || NEW.order_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for purchase order inventory updates
CREATE TRIGGER on_purchase_order_status_change
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_order_inventory();

-- Function to handle stock level adjustment transactions
CREATE OR REPLACE FUNCTION public.handle_stock_level_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  previous_quantity INTEGER;
  quantity_change INTEGER;
BEGIN
  -- Get the previous quantity
  IF TG_OP = 'UPDATE' THEN
    previous_quantity := OLD.quantity_on_hand;
  ELSE
    previous_quantity := 0;
  END IF;
  
  -- Calculate quantity change
  quantity_change := NEW.quantity_on_hand - previous_quantity;
  
  -- Only create transaction if there's an actual change
  IF quantity_change != 0 THEN
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.product_id,
      'adjustment',
      quantity_change,
      'stock_level',
      NEW.id,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Initial stock level set'
        WHEN quantity_change > 0 THEN 'Stock level increased'
        ELSE 'Stock level decreased'
      END,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for stock level adjustments
CREATE TRIGGER on_stock_level_change
  AFTER INSERT OR UPDATE ON public.stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_level_adjustment();

-- Function to handle initial stock quantity for new products
CREATE OR REPLACE FUNCTION public.handle_new_product_initial_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new product is created, create initial stock level if initial_quantity is provided
  IF NEW.initial_quantity IS NOT NULL AND NEW.initial_quantity > 0 THEN
    -- Insert initial stock level
    INSERT INTO public.stock_levels (
      product_id,
      quantity_on_hand,
      quantity_reserved,
      quantity_available,
      created_by
    ) VALUES (
      NEW.id,
      NEW.initial_quantity,
      0,
      NEW.initial_quantity,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
    
    -- Create inventory transaction for initial stock
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.id,
      'adjustment',
      NEW.initial_quantity,
      'product_creation',
      NEW.id,
      'Initial stock quantity set on product creation: ' || NEW.name,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for new product initial stock
CREATE TRIGGER on_new_product_created
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_product_initial_stock();

-- Add initial_quantity column to products table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'initial_quantity') THEN
    ALTER TABLE public.products ADD COLUMN initial_quantity INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create indexes for better performance on inventory transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_type ON public.inventory_transactions(reference_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_id ON public.inventory_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON public.inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_transaction_type ON public.inventory_transactions(transaction_type);

-- Create indexes for sales and purchase orders
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_sale_invoices_status ON public.sale_invoices(status);

-- Verify the triggers were created successfully
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name IN (
  'on_sales_order_status_change',
  'on_purchase_order_status_change', 
  'on_stock_level_change',
  'on_new_product_created',
  'on_sale_invoice_status_change'
)
ORDER BY trigger_name; 