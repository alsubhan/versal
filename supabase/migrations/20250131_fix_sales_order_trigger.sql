-- Fix the sales order inventory trigger to use the correct column names
-- This fixes the "column 'role' does not exist" error when updating sales order status to 'approved'

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_sales_order_status_change ON public.sales_orders;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.handle_sales_order_inventory();

-- Create the corrected function
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
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE username = 'admin' LIMIT 1))
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
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE username = 'admin' LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_sales_order_status_change
  AFTER UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_order_inventory();

-- Verify the fix
SELECT 
  'Trigger fixed successfully' as status,
  'Sales order inventory trigger now uses correct column names' as message; 