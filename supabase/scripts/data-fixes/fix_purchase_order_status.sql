-- Fix Purchase Orders with invalid "confirmed" status
-- Change them to "pending" status which is a valid enum value

UPDATE purchase_orders 
SET status = 'pending'::order_status 
WHERE status = 'confirmed';

-- Verify the fix
SELECT id, order_number, status 
FROM purchase_orders 
WHERE status = 'confirmed';

-- Should return 0 rows if the fix worked 