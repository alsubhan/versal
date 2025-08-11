-- Temporarily disable the payment amount triggers that are causing the issue
-- These triggers are calling update_invoice_payment_amounts() which is updating invoice status

DROP TRIGGER IF EXISTS trg_update_invoice_payment_amounts_insert ON customer_payments;
DROP TRIGGER IF EXISTS trg_update_invoice_payment_amounts_update ON customer_payments;
DROP TRIGGER IF EXISTS trg_update_invoice_payment_amounts_delete ON customer_payments;

-- This will allow payments to be created without triggering the problematic function
-- We can re-enable them once we fix the underlying issue
