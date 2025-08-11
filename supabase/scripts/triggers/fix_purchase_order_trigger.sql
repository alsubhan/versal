-- Fix Purchase Order Trigger to use correct status values
-- The trigger currently checks for 'confirmed' but the enum only allows:
-- 'draft', 'pending', 'approved', 'received', 'cancelled'

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_purchase_order_status_change ON public.purchase_orders;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.handle_purchase_order_inventory();

-- Recreate the function with correct status values
CREATE OR REPLACE FUNCTION public.handle_purchase_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When purchase order status changes to 'approved' (instead of 'confirmed')
  IF NEW.status IN ('approved') AND 
     OLD.status NOT IN ('approved') THEN
    
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

-- Verify the fix
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_purchase_order_status_change'; 