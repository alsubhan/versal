-- Migration: Update Sales Order Status Enum and Create Triggers
-- This migration adds missing statuses and creates triggers for credit management

-- Step 1: Add missing statuses to so_status enum
DO $$
BEGIN
    -- Add 'partial' status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'so_status') AND enumlabel = 'partial') THEN
        ALTER TYPE public.so_status ADD VALUE 'partial';
    END IF;
    
    -- Add 'fulfilled' status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'so_status') AND enumlabel = 'fulfilled') THEN
        ALTER TYPE public.so_status ADD VALUE 'fulfilled';
    END IF;
    
    RAISE NOTICE 'Added missing statuses to so_status enum';
END $$;

-- Step 2: Create function to update customers.current_credit
CREATE OR REPLACE FUNCTION update_customer_current_credit()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_invoice_amount DECIMAL(12,2);
    v_payment_amount DECIMAL(12,2);
    v_current_credit DECIMAL(12,2);
BEGIN
    -- Get customer ID and invoice amount
    IF TG_OP = 'INSERT' THEN
        v_customer_id := NEW.customer_id;
        v_payment_amount := NEW.payment_amount;
        
        -- Get the invoice amount for this payment
        SELECT amount_due INTO v_invoice_amount
        FROM sale_invoices
        WHERE id = NEW.sale_invoice_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_id := NEW.customer_id;
        v_payment_amount := NEW.payment_amount - COALESCE(OLD.payment_amount, 0);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_customer_id := OLD.customer_id;
        v_payment_amount := -OLD.payment_amount;
    END IF;
    
    -- Only process if this is a credit invoice
    IF EXISTS (
        SELECT 1 FROM sale_invoices 
        WHERE id = COALESCE(NEW.sale_invoice_id, OLD.sale_invoice_id) 
        AND payment_method = 'credit'
    ) THEN
        -- Calculate current outstanding credit for this customer
        SELECT COALESCE(SUM(amount_due), 0) INTO v_current_credit
        FROM sale_invoices
        WHERE customer_id = v_customer_id
        AND payment_method = 'credit'
        AND status NOT IN ('paid', 'cancelled', 'draft');
        
        -- Update customers.current_credit
        UPDATE customers 
        SET current_credit = v_current_credit,
            updated_at = NOW()
        WHERE id = v_customer_id;
        
        RAISE NOTICE 'Updated current_credit for customer % to %', v_customer_id, v_current_credit;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger for customer_payments table
DROP TRIGGER IF EXISTS trg_update_customer_current_credit ON customer_payments;
CREATE TRIGGER trg_update_customer_current_credit
    AFTER INSERT OR UPDATE OR DELETE ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_current_credit();

-- Step 4: Create function to update Sale Order status based on Invoice status
CREATE OR REPLACE FUNCTION update_sales_order_status_from_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_sales_order_id UUID;
    v_invoice_status invoice_status;
    v_new_so_status so_status;
BEGIN
    -- Get the sales order ID from the invoice
    v_sales_order_id := NEW.sales_order_id;
    v_invoice_status := NEW.status;
    
    -- Only process if there's a linked sales order
    IF v_sales_order_id IS NOT NULL THEN
        -- Map invoice status to sales order status
        CASE v_invoice_status
            WHEN 'partial' THEN
                v_new_so_status := 'partial'::so_status;
            WHEN 'paid' THEN
                v_new_so_status := 'fulfilled'::so_status;
            WHEN 'overdue' THEN
                v_new_so_status := 'overdue'::so_status;
            WHEN 'cancelled' THEN
                v_new_so_status := 'cancelled'::so_status;
            ELSE
                -- For other statuses, don't change sales order status
                RETURN NEW;
        END CASE;
        
        -- Update sales order status
        UPDATE sales_orders 
        SET status = v_new_so_status,
            updated_at = NOW()
        WHERE id = v_sales_order_id;
        
        RAISE NOTICE 'Updated sales order % status to % based on invoice status %', 
                    v_sales_order_id, v_new_so_status, v_invoice_status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for sale_invoices table
DROP TRIGGER IF EXISTS trg_update_sales_order_status ON sale_invoices;
CREATE TRIGGER trg_update_sales_order_status
    AFTER UPDATE ON sale_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_order_status_from_invoice();

-- Step 6: Update existing customers.current_credit to reflect current outstanding credit
UPDATE customers 
SET current_credit = COALESCE((
    SELECT SUM(amount_due) 
    FROM sale_invoices 
    WHERE customer_id = customers.id 
    AND payment_method = 'credit' 
    AND status NOT IN ('paid', 'cancelled', 'draft')
), 0),
updated_at = NOW()
WHERE customer_type IN ('wholesale', 'distributor');

-- Step 7: Update existing sales orders status based on their invoices
UPDATE sales_orders 
SET status = CASE 
    WHEN EXISTS (
        SELECT 1 FROM sale_invoices 
        WHERE sales_order_id = sales_orders.id 
        AND status = 'paid'
    ) THEN 'fulfilled'::so_status
    WHEN EXISTS (
        SELECT 1 FROM sale_invoices 
        WHERE sales_order_id = sales_orders.id 
        AND status = 'partial'
    ) THEN 'partial'::so_status
    WHEN EXISTS (
        SELECT 1 FROM sale_invoices 
        WHERE sales_order_id = sales_orders.id 
        AND status = 'overdue'
    ) THEN 'overdue'::so_status
    ELSE sales_orders.status
END,
updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM sale_invoices 
    WHERE sales_order_id = sales_orders.id
);

RAISE NOTICE 'Migration completed successfully: Added missing Sale Order statuses and created triggers for credit management';
