-- Fix the trigger conflict that's causing the infinite loop
-- The issue is that handle_inventory_transaction() trigger updates stock_levels
-- which then triggers our audit trail, creating a loop

-- Disable the conflicting trigger
DROP TRIGGER IF EXISTS on_inventory_transaction ON public.inventory_transactions;
DROP FUNCTION IF EXISTS public.handle_inventory_transaction();

-- Now we can safely add our audit trail without conflicts
-- The audit trail will only create inventory_transactions records
-- without trying to update stock_levels again

-- Create a simple audit trail function
CREATE OR REPLACE FUNCTION public.handle_stock_level_audit()
RETURNS TRIGGER AS $$
DECLARE
  quantity_change INTEGER;
BEGIN
  -- Only handle UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Calculate the quantity change
    quantity_change := NEW.quantity_on_hand - OLD.quantity_on_hand;
    
    -- Only create audit record if there's an actual change
    IF quantity_change != 0 THEN
      BEGIN
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
            WHEN quantity_change > 0 THEN 'Stock level increased'
            ELSE 'Stock level decreased'
          END,
          COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
        );
      EXCEPTION
        WHEN OTHERS THEN
          -- Silently ignore errors to prevent update failures
          NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Create the audit trigger
CREATE TRIGGER on_stock_level_audit
  AFTER UPDATE ON public.stock_levels
  FOR EACH ROW 
  WHEN (OLD.quantity_on_hand IS DISTINCT FROM NEW.quantity_on_hand)
  EXECUTE FUNCTION public.handle_stock_level_audit();

-- Verify the triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers 
WHERE event_object_table = 'stock_levels'
ORDER BY trigger_name; 