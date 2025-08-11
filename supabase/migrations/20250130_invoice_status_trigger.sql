-- Function to automatically update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_status_from_payments()
RETURNS TRIGGER AS $$
DECLARE
    invoice_total DECIMAL(15,2);
    total_paid DECIMAL(15,2);
    invoice_status_val invoice_status;
BEGIN
    -- Get the invoice total amount
    SELECT total_amount INTO invoice_total
    FROM sale_invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid
    FROM customer_payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Determine the appropriate status
    IF total_paid = 0 THEN
        invoice_status_val := 'sent';
    ELSIF total_paid >= invoice_total THEN
        invoice_status_val := 'paid';
    ELSIF total_paid > 0 THEN
        invoice_status_val := 'partial';
    ELSE
        invoice_status_val := 'sent';
    END IF;
    
    -- Update the invoice status
    UPDATE sale_invoices 
    SET status = invoice_status_val,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update invoice status when payments are added/updated/deleted
DROP TRIGGER IF EXISTS trigger_update_invoice_status ON customer_payments;

CREATE TRIGGER trigger_update_invoice_status
    AFTER INSERT OR UPDATE OR DELETE ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_status_from_payments();

-- Add comment explaining the trigger
COMMENT ON FUNCTION update_invoice_status_from_payments() IS 'Automatically updates invoice status based on payment amounts: partial when some payment made, paid when fully paid';
