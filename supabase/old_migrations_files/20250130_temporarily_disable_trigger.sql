-- Temporarily disable the trigger to isolate the issue
DROP TRIGGER IF EXISTS trigger_update_invoice_status ON customer_payments;

-- This will allow payments to be created without triggering the status update
-- We can re-enable it once we fix the underlying issue
