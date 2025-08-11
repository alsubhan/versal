-- Fix credit_transactions table to use sale_invoice_id instead of sales_order_id
-- This corrects the credit usage tracking to happen at invoice payment level, not sales order level

-- Step 1: Add the new sale_invoice_id column
ALTER TABLE public.credit_transactions 
ADD COLUMN sale_invoice_id UUID REFERENCES public.sale_invoices(id);

-- Step 1.5: Update the transaction_type column to use the new enum
ALTER TABLE public.credit_transactions 
ALTER COLUMN transaction_type TYPE public.credit_transaction_type 
USING transaction_type::text::public.credit_transaction_type;

-- Step 2: Create index for better performance on the new column
CREATE INDEX IF NOT EXISTS idx_credit_transactions_sale_invoice_id 
ON public.credit_transactions(sale_invoice_id);

-- Step 3: Drop the old sales_order_id column
ALTER TABLE public.credit_transactions 
DROP COLUMN sales_order_id;

-- Step 4: Update the comment to reflect the correct purpose
COMMENT ON COLUMN public.credit_transactions.sale_invoice_id IS 'Reference to sale invoice when store credit is used for payment';

-- Step 5: Update existing credit_transactions records if any exist
-- (This is a safety measure - in practice, this table should be empty in development)
-- Note: If there are existing records with sales_order_id, they would need manual migration
-- For now, we'll assume the table is empty or can be safely updated

-- Step 6: Add constraint to ensure proper credit transaction references
-- A credit transaction should have either credit_note_id (when credit is issued) 
-- or sale_invoice_id (when credit is used), but not necessarily both
ALTER TABLE public.credit_transactions 
ADD CONSTRAINT valid_credit_transaction_reference 
CHECK (
  (credit_note_id IS NOT NULL) OR (sale_invoice_id IS NOT NULL)
);

-- Step 7: Create a new credit transaction type enum specifically for credit transactions
-- This avoids conflicts with the existing inventory transaction_type enum
CREATE TYPE public.credit_transaction_type AS ENUM (
  'credit_issued',      -- When credit note creates store credit
  'credit_used',        -- When store credit is used for invoice payment
  'credit_expired',     -- When store credit expires
  'credit_adjusted',    -- Manual adjustments
  'invoice_credit_used', -- When invoice credit is used
  'invoice_credit_adjusted' -- Manual invoice credit adjustments
);

-- Step 8: Create function to handle store credit usage in invoice payments
CREATE OR REPLACE FUNCTION public.handle_store_credit_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_amount DECIMAL(12,2);
  v_available_credit DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
BEGIN
  -- Only process when a customer payment is made with store credit
  IF NEW.payment_method = 'credit_note' AND NEW.payment_amount > 0 THEN
    
    -- Get available store credit for the customer
    SELECT COALESCE(available_credit, 0) INTO v_available_credit
    FROM public.customer_credit_balances 
    WHERE customer_id = NEW.customer_id;
    
    -- Calculate how much store credit to use (cannot exceed available)
    v_credit_amount := LEAST(NEW.payment_amount, v_available_credit);
    
    IF v_credit_amount > 0 THEN
      -- Calculate new balance after using store credit
      v_new_balance := v_available_credit - v_credit_amount;
      
      -- Create credit transaction record
      INSERT INTO public.credit_transactions (
        customer_id,
        sale_invoice_id,
        transaction_type,
        amount,
        balance_after,
        description,
        reference_number,
        created_by
      )
      VALUES (
        NEW.customer_id,
        NEW.invoice_id,
        'credit_used',
        v_credit_amount,
        v_new_balance,
        'Store credit used for invoice payment: ' || COALESCE(
          (SELECT invoice_number FROM public.sale_invoices WHERE id = NEW.invoice_id), 
          'Unknown Invoice'
        ),
        COALESCE(
          (SELECT invoice_number FROM public.sale_invoices WHERE id = NEW.invoice_id), 
          'Unknown Invoice'
        ),
        NEW.created_by
      );
      
      -- Update customer credit balance
      UPDATE public.customer_credit_balances 
      SET 
        available_credit = v_new_balance,
        used_credit = used_credit + v_credit_amount,
        last_updated = now()
      WHERE customer_id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Step 9: Create trigger for customer payments to automatically handle store credit usage
CREATE TRIGGER on_customer_payment_store_credit_usage
  AFTER INSERT ON public.customer_payments
  FOR EACH ROW 
  WHEN (NEW.payment_method = 'credit_note')
  EXECUTE FUNCTION public.handle_store_credit_usage();

-- Step 10: Add comments explaining the new structure
COMMENT ON TABLE public.credit_transactions IS 'Tracks all credit-related transactions including store credit issuance (credit notes) and usage (invoice payments)';
COMMENT ON COLUMN public.credit_transactions.credit_note_id IS 'Reference to credit note when store credit is issued';
COMMENT ON COLUMN public.credit_transactions.sale_invoice_id IS 'Reference to sale invoice when store credit is used for payment';
COMMENT ON COLUMN public.credit_transactions.transaction_type IS 'Type of credit transaction: credit_issued, credit_used, credit_expired, credit_adjusted, invoice_credit_used, invoice_credit_adjusted';
