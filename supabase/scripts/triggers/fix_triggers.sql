-- Fix the database triggers that have incorrect role column references
-- This script fixes the "column 'role' does not exist" error

-- Drop the existing triggers first
DROP TRIGGER IF EXISTS on_stock_level_change ON public.stock_levels;
DROP TRIGGER IF EXISTS on_sales_order_status_change ON public.sales_orders;
DROP TRIGGER IF EXISTS on_sale_invoice_status_change ON public.sale_invoices;
DROP TRIGGER IF EXISTS on_purchase_order_status_change ON public.purchase_orders;
DROP TRIGGER IF EXISTS on_new_product_created ON public.products;

-- Drop the existing functions
DROP FUNCTION IF EXISTS public.handle_stock_level_adjustment();
DROP FUNCTION IF EXISTS public.handle_sales_order_inventory();
DROP FUNCTION IF EXISTS public.handle_sale_invoice_inventory();
DROP FUNCTION IF EXISTS public.handle_purchase_order_inventory();
DROP FUNCTION IF EXISTS public.handle_new_product_initial_stock();

-- Recreate the functions with correct role references
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

-- Recreate the trigger
CREATE TRIGGER on_stock_level_change
  AFTER INSERT OR UPDATE ON public.stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_level_adjustment();

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

-- Recreate the trigger
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

-- Recreate the trigger
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

-- Recreate the trigger
CREATE TRIGGER on_purchase_order_status_change
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_order_inventory();

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

-- Recreate the trigger
CREATE TRIGGER on_new_product_created
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_product_initial_stock();

-- Verify the triggers were recreated successfully
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name IN (
  'on_stock_level_change',
  'on_sales_order_status_change', 
  'on_sale_invoice_status_change',
  'on_purchase_order_status_change',
  'on_new_product_created'
)
ORDER BY trigger_name; 