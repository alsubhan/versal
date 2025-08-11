-- Customer Payments Table Migration
-- This migration adds a table to track customer payments for invoices

-- Create customer_payments table for tracking actual payments
CREATE TABLE IF NOT EXISTS public.customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.sale_invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) NOT NULL,
    payment_amount DECIMAL(12,2) NOT NULL CHECK (payment_amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'online', 'credit', 'credit_note')),
    payment_reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies for customer_payments table
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.customer_payments
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.customer_payments
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.customer_payments
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.customer_payments
FOR DELETE USING (auth.role() = 'authenticated');

-- Create a function to update amount_paid and amount_due in sale_invoices
CREATE OR REPLACE FUNCTION update_invoice_payment_amounts()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid DECIMAL(12,2);
    v_total_amount DECIMAL(12,2);
    v_new_status TEXT;
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

-- Create triggers for insert, update, and delete on customer_payments
CREATE OR REPLACE TRIGGER trg_update_invoice_payment_amounts_insert
AFTER INSERT ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_amounts();

CREATE OR REPLACE TRIGGER trg_update_invoice_payment_amounts_update
AFTER UPDATE OF payment_amount ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_amounts();

CREATE OR REPLACE TRIGGER trg_update_invoice_payment_amounts_delete
AFTER DELETE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_amounts();
