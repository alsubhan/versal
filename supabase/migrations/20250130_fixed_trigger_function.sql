-- Fixed and more robust trigger function
CREATE OR REPLACE FUNCTION update_invoice_status_from_payments()
RETURNS TRIGGER AS $$
DECLARE
    invoice_total DECIMAL(15,2);
    total_paid DECIMAL(15,2);
    invoice_status_val invoice_status;
    invoice_id_val UUID;
BEGIN
    -- Get the invoice ID (handle both INSERT and DELETE cases)
    invoice_id_val := COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Safety check
    IF invoice_id_val IS NULL THEN
        RAISE LOG 'update_invoice_status_from_payments: invoice_id is NULL';
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get the invoice total amount
    SELECT total_amount INTO invoice_total
    FROM sale_invoices
    WHERE id = invoice_id_val;
    
    -- Safety check
    IF invoice_total IS NULL THEN
        RAISE LOG 'update_invoice_status_from_payments: invoice not found for id %', invoice_id_val;
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate total payments for this invoice
    SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid
    FROM customer_payments
    WHERE invoice_id = invoice_id_val;
    
    -- Safety check
    IF total_paid IS NULL THEN
        total_paid := 0;
    END IF;
    
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
    
    -- Log the status change for debugging
    RAISE LOG 'update_invoice_status_from_payments: invoice %: total=% payment=% status=%', 
        invoice_id_val, invoice_total, total_paid, invoice_status_val;
    
    -- Update the invoice status
    UPDATE sale_invoices 
    SET status = invoice_status_val,
        updated_at = NOW()
    WHERE id = invoice_id_val;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE LOG 'update_invoice_status_from_payments: error updating invoice %: %', invoice_id_val, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_invoice_status
    AFTER INSERT OR UPDATE OR DELETE ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_status_from_payments();

-- Add comment explaining the trigger
COMMENT ON FUNCTION update_invoice_status_from_payments() IS 'Automatically updates invoice status based on payment amounts: partial when some payment made, paid when fully paid';
