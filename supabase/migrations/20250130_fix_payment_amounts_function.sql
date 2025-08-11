-- Fix the update_invoice_payment_amounts function to use the correct enum type
-- The issue is that v_new_status is declared as TEXT but should be invoice_status

CREATE OR REPLACE FUNCTION update_invoice_payment_amounts()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid DECIMAL(12,2);
    v_total_amount DECIMAL(12,2);
    v_new_status invoice_status;  -- Changed from TEXT to invoice_status
    v_invoice_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;

    -- Calculate total paid for the invoice
    SELECT COALESCE(SUM(payment_amount), 0)
    INTO v_total_paid
    FROM public.customer_payments
    WHERE invoice_id = v_invoice_id;

    -- Get the total amount of the invoice
    SELECT total_amount
    INTO v_total_amount
    FROM public.sale_invoices
    WHERE id = v_invoice_id;

    -- Determine new status
    IF v_total_paid >= v_total_amount THEN
        v_new_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'sent'; -- Or 'draft' if it was never sent
    END IF;

    -- Update the sale_invoice
    UPDATE public.sale_invoices
    SET
        amount_paid = v_total_paid,
        amount_due = v_total_amount - v_total_paid,
        status = v_new_status,
        updated_at = now()
    WHERE id = v_invoice_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION update_invoice_payment_amounts() IS 'Updates invoice payment amounts and status based on customer payments';
