-- Credit Validation and Management Functions
-- This migration adds functions for credit limit validation and credit balance management

-- Function to check if customer has sufficient credit for an invoice
CREATE OR REPLACE FUNCTION check_customer_credit_limit(
    p_customer_id UUID,
    p_invoice_amount DECIMAL(12,2)
)
RETURNS TABLE(
    has_sufficient_credit BOOLEAN,
    credit_limit DECIMAL(12,2),
    available_credit DECIMAL(12,2),
    used_credit DECIMAL(12,2),
    total_credit_balance DECIMAL(12,2), -- This represents store credit, separate from invoice credit limit
    required_amount DECIMAL(12,2),
    message TEXT
) AS $$
DECLARE
    v_customer_type TEXT;
    v_credit_limit DECIMAL(12,2);
    v_available_credit DECIMAL(12,2);
    v_used_credit DECIMAL(12,2);
    v_total_credit_balance DECIMAL(12,2); -- Store credit
    v_current_credit_usage DECIMAL(12,2);
BEGIN
    -- Get customer's credit limit and type
    SELECT c.credit_limit, c.customer_type
    INTO v_credit_limit, v_customer_type
    FROM public.customers c
    WHERE c.id = p_customer_id;

    IF v_credit_limit IS NULL THEN
        v_credit_limit := 0;
    END IF;

    -- If customer type is not wholesale or distributor, credit limit is not applicable for this check.
    IF v_customer_type NOT IN ('wholesale', 'distributor') THEN
        RETURN QUERY SELECT TRUE, v_credit_limit, 0.00, 0.00, 0.00, p_invoice_amount, 'Credit limit not applicable for this customer type.';
        RETURN;
    END IF;

    -- Calculate current credit usage from outstanding invoices with payment_method = 'credit'
    -- This is the sum of (total_amount - amount_paid) for relevant invoices.
    SELECT COALESCE(SUM(amount_due), 0)
    INTO v_current_credit_usage
    FROM public.sale_invoices
    WHERE customer_id = p_customer_id
      AND payment_method = 'credit'
      AND status NOT IN ('paid', 'cancelled', 'draft'); -- Only consider outstanding credit invoices

    -- Get the customer's current store credit balance (from credit notes, etc.)
    SELECT COALESCE(total_credit_balance, 0)
    INTO v_total_credit_balance
    FROM public.customer_credit_balances
    WHERE customer_id = p_customer_id;

    -- Used credit is what they already owe on other credit invoices
    v_used_credit := v_current_credit_usage;

    -- Available credit from their limit
    v_available_credit := v_credit_limit - v_used_credit;

    -- Check if the new invoice amount exceeds the available credit limit
    IF p_invoice_amount > v_available_credit THEN
        RETURN QUERY SELECT FALSE, v_credit_limit, v_available_credit, v_used_credit, v_total_credit_balance, p_invoice_amount,
            'Invoice amount (' || p_invoice_amount || ') exceeds available credit limit (' || v_available_credit || '). Total credit limit: ' || v_credit_limit || ', Current credit usage: ' || v_used_credit || '.';
    ELSE
        RETURN QUERY SELECT TRUE, v_credit_limit, v_available_credit, v_used_credit, v_total_credit_balance, p_invoice_amount, 'Sufficient credit available.';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer store credit balance (for 'credit' payments from credit notes or direct top-ups)
-- This is separate from the invoice credit limit.
CREATE OR REPLACE FUNCTION update_customer_credit_balance(
    p_customer_id UUID,
    p_amount DECIMAL(12,2),
    p_type TEXT, -- 'add' for credit notes/top-ups, 'deduct' for using store credit
    p_notes TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Insert or update the customer's credit balance
    INSERT INTO public.customer_credit_balances (customer_id, total_credit_balance)
    VALUES (p_customer_id, CASE WHEN p_type = 'add' THEN p_amount ELSE -p_amount END)
    ON CONFLICT (customer_id) DO UPDATE
    SET total_credit_balance = public.customer_credit_balances.total_credit_balance + EXCLUDED.total_credit_balance;

    -- Log the transaction for audit purposes
    INSERT INTO public.credit_transactions (customer_id, transaction_type, amount, new_balance, notes)
    SELECT p_customer_id,
           CASE WHEN p_type = 'add' THEN 'credit_added' ELSE 'credit_used' END,
           p_amount,
           total_credit_balance,
           p_notes
    FROM public.customer_credit_balances
    WHERE customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql;
