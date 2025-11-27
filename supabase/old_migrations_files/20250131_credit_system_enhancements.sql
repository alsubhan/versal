-- Migration: Credit System Enhancements
-- This migration ensures proper credit transaction creation and balance management

-- Step 1: Update the handle_credit_note_approval function to handle both invoice_linked and standalone credit notes
CREATE OR REPLACE FUNCTION public.handle_credit_note_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to approved and refund method is store credit
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.refund_method = 'store_credit' THEN
    -- Create credit transaction for credit issued
    INSERT INTO public.credit_transactions (
      customer_id,
      credit_note_id,
      transaction_type,
      amount,
      balance_after,
      description,
      reference_number,
      created_by
    )
    SELECT 
      NEW.customer_id,
      NEW.id,
      'credit_issued',
      NEW.total_amount,
      COALESCE((SELECT available_credit FROM public.customer_credit_balances WHERE customer_id = NEW.customer_id), 0) + NEW.total_amount,
      CASE 
        WHEN NEW.credit_note_type = 'invoice_linked' THEN 
          'Store credit issued via Credit Note: ' || NEW.credit_note_number || ' (Invoice: ' || 
          (SELECT invoice_number FROM public.sale_invoices WHERE id = NEW.invoice_id) || ')'
        ELSE 
          'Store credit issued via Credit Note: ' || NEW.credit_note_number
      END,
      NEW.credit_note_number,
      NEW.approved_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Step 2: Create function to handle credit usage when payments are made using store credit
CREATE OR REPLACE FUNCTION public.handle_store_credit_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_amount DECIMAL(12,2);
  v_available_credit DECIMAL(12,2);
  v_balance_after DECIMAL(12,2);
BEGIN
  -- Only process when payment method is store credit
  IF NEW.payment_method = 'store_credit' THEN
    -- Get available credit for the customer
    SELECT available_credit INTO v_available_credit
    FROM public.customer_credit_balances
    WHERE customer_id = NEW.customer_id;
    
    -- Check if customer has sufficient credit
    IF v_available_credit < NEW.payment_amount THEN
      RAISE EXCEPTION 'Insufficient store credit. Available: %, Required: %', v_available_credit, NEW.payment_amount;
    END IF;
    
    -- Calculate credit amount to use
    v_credit_amount := LEAST(NEW.payment_amount, v_available_credit);
    v_balance_after := v_available_credit - v_credit_amount;
    
    -- Create credit transaction for credit used
    INSERT INTO public.credit_transactions (
      customer_id,
      credit_note_id,
      transaction_type,
      amount,
      balance_after,
      description,
      reference_number,
      created_by
    )
    VALUES (
      NEW.customer_id,
      NULL, -- No specific credit note for usage
      'credit_used',
      v_credit_amount,
      v_balance_after,
      'Store credit used for payment: Invoice #' || 
      (SELECT invoice_number FROM public.sale_invoices WHERE id = NEW.invoice_id),
      'PAY-' || NEW.id,
      NEW.created_by
    );
    
    -- Update customer credit balance
    UPDATE public.customer_credit_balances
    SET 
      available_credit = v_balance_after,
      used_credit = used_credit + v_credit_amount,
      last_updated = now()
    WHERE customer_id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Step 3: Create trigger for store credit usage
DROP TRIGGER IF EXISTS on_customer_payment_store_credit_usage ON public.customer_payments;
CREATE TRIGGER on_customer_payment_store_credit_usage
  AFTER INSERT ON public.customer_payments 
  FOR EACH ROW 
  WHEN (NEW.payment_method = 'store_credit')
  EXECUTE FUNCTION public.handle_store_credit_usage();

-- Step 4: Update the handle_customer_credit_balance function to properly handle all transaction types
CREATE OR REPLACE FUNCTION public.handle_customer_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update customer credit balance
  INSERT INTO public.customer_credit_balances (customer_id, total_credit_balance, available_credit, used_credit)
  VALUES (
    NEW.customer_id, 
    CASE 
      WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
      ELSE 0
    END,
    CASE 
      WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
      ELSE 0
    END,
    CASE 
      WHEN NEW.transaction_type = 'credit_used' THEN NEW.amount
      ELSE 0
    END
  )
  ON CONFLICT (customer_id)
  DO UPDATE SET
    total_credit_balance = customer_credit_balances.total_credit_balance + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        ELSE 0 
      END,
    available_credit = customer_credit_balances.available_credit + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        WHEN NEW.transaction_type = 'credit_used' THEN -NEW.amount
        ELSE 0 
      END,
    used_credit = customer_credit_balances.used_credit + 
      CASE 
        WHEN NEW.transaction_type = 'credit_used' THEN NEW.amount
        ELSE 0 
      END,
    last_updated = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Step 5: Add comments to explain the enhanced credit system
COMMENT ON FUNCTION public.handle_credit_note_approval() IS 'Creates credit transactions when credit notes are approved and sets refund method to store_credit';
COMMENT ON FUNCTION public.handle_store_credit_usage() IS 'Handles store credit usage when payments are made using store credit method';
COMMENT ON FUNCTION public.handle_customer_credit_balance() IS 'Updates customer credit balances based on credit transactions';
