-- Create Credit Notes table
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE NOT NULL,
  
  -- Reference to original sale
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  
  -- Credit note details
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT CHECK (reason IN ('return', 'damage', 'billing_error', 'discount', 'cancellation', 'price_adjustment', 'other')) NOT NULL,
  reason_description TEXT,
  
  -- Status and processing
  status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'processed', 'cancelled')) DEFAULT 'draft',
  approval_required BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES public.profiles(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  
  -- Financial details
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Processing details
  refund_method TEXT CHECK (refund_method IN ('cash', 'bank_transfer', 'credit_account', 'store_credit', 'exchange')) DEFAULT 'credit_account',
  refund_processed BOOLEAN DEFAULT false,
  refund_date DATE,
  refund_reference TEXT,
  
  -- Inventory impact
  affects_inventory BOOLEAN DEFAULT true,
  inventory_processed BOOLEAN DEFAULT false,
  
  -- Additional info
  notes TEXT,
  internal_notes TEXT,
  
  -- Audit trail
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Credit Note Items table
CREATE TABLE public.credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  
  -- Product and original sale reference
  product_id UUID REFERENCES public.products(id) NOT NULL,
  sales_order_item_id UUID REFERENCES public.sales_order_items(id), -- Reference to original sale item
  
  -- Quantities and pricing
  original_quantity INTEGER, -- Original sold quantity
  credit_quantity INTEGER NOT NULL CHECK (credit_quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((credit_quantity * unit_price) - discount + tax) STORED,
  
  -- Return details (if applicable)
  returned_quantity INTEGER DEFAULT 0,
  condition_on_return TEXT CHECK (condition_on_return IN ('good', 'damaged', 'defective', 'expired', 'incomplete')) DEFAULT 'good',
  return_to_stock BOOLEAN DEFAULT true,
  
  -- Quality and location
  batch_number TEXT,
  expiry_date DATE,
  storage_location TEXT,
  quality_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure credit quantity doesn't exceed original if referenced
  CONSTRAINT valid_credit_quantity CHECK (
    sales_order_item_id IS NULL OR 
    credit_quantity <= COALESCE(original_quantity, credit_quantity)
  )
);

-- Create Customer Credit Balance table (to track store credits)
CREATE TABLE public.customer_credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) UNIQUE NOT NULL,
  total_credit_balance DECIMAL(12,2) DEFAULT 0,
  available_credit DECIMAL(12,2) DEFAULT 0,
  used_credit DECIMAL(12,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Credit Transactions table (detailed credit ledger)
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  credit_note_id UUID REFERENCES public.credit_notes(id),
  sales_order_id UUID REFERENCES public.sales_orders(id), -- When credit is used
  
  transaction_type TEXT CHECK (transaction_type IN ('credit_issued', 'credit_used', 'credit_expired', 'credit_adjusted')) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  
  description TEXT,
  reference_number TEXT,
  expiry_date DATE, -- For store credits that expire
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Credit Notes tables
CREATE POLICY "All authenticated users access" ON public.credit_notes
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.credit_note_items
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.customer_credit_balances
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.credit_transactions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_credit_notes_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_note_items_updated_at
  BEFORE UPDATE ON public.credit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle credit note inventory updates
CREATE OR REPLACE FUNCTION public.handle_credit_note_inventory()
RETURNS TRIGGER AS $$
DECLARE
  credit_note_record RECORD;
BEGIN
  -- Get credit note details
  SELECT * INTO credit_note_record 
  FROM public.credit_notes 
  WHERE id = NEW.credit_note_id;
  
  -- Only process if credit note affects inventory and is approved
  IF credit_note_record.affects_inventory AND credit_note_record.status = 'approved' AND NEW.return_to_stock THEN
    -- Create inventory transaction for returned goods
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.product_id,
      'adjustment', -- Returns are adjustments
      NEW.returned_quantity,
      'credit_note',
      NEW.credit_note_id,
      'Goods returned via Credit Note: ' || credit_note_record.credit_note_number || 
      ' - Condition: ' || COALESCE(NEW.condition_on_return, 'good'),
      credit_note_record.created_by
    );
    
    -- Mark inventory as processed
    UPDATE public.credit_notes 
    SET inventory_processed = true 
    WHERE id = NEW.credit_note_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for credit note inventory updates
CREATE TRIGGER on_credit_note_item_change
  AFTER INSERT OR UPDATE ON public.credit_note_items
  FOR EACH ROW 
  WHEN (NEW.returned_quantity > 0)
  EXECUTE FUNCTION public.handle_credit_note_inventory();

-- Function to handle customer credit balance updates
CREATE OR REPLACE FUNCTION public.handle_customer_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update customer credit balance
  INSERT INTO public.customer_credit_balances (customer_id, total_credit_balance, available_credit)
  VALUES (NEW.customer_id, NEW.amount, NEW.amount)
  ON CONFLICT (customer_id)
  DO UPDATE SET
    total_credit_balance = customer_credit_balances.total_credit_balance + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        WHEN NEW.transaction_type = 'credit_used' THEN -NEW.amount
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

-- Trigger for customer credit balance updates
CREATE TRIGGER on_credit_transaction
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_customer_credit_balance();

-- Function to automatically create credit transaction when credit note is approved
CREATE OR REPLACE FUNCTION public.handle_credit_note_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to approved and refund method is store credit
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.refund_method = 'store_credit' THEN
    -- Create credit transaction
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
      'Store credit issued via Credit Note: ' || NEW.credit_note_number,
      NEW.credit_note_number,
      NEW.approved_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for credit note approval
CREATE TRIGGER on_credit_note_approval
  AFTER UPDATE ON public.credit_notes
  FOR EACH ROW 
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION public.handle_credit_note_approval();

-- Create indexes for better performance
CREATE INDEX idx_credit_notes_customer_id ON public.credit_notes(customer_id);
CREATE INDEX idx_credit_notes_sales_order_id ON public.credit_notes(sales_order_id);
CREATE INDEX idx_credit_notes_status ON public.credit_notes(status);
CREATE INDEX idx_credit_notes_credit_date ON public.credit_notes(credit_date);
CREATE INDEX idx_credit_note_items_credit_note_id ON public.credit_note_items(credit_note_id);
CREATE INDEX idx_credit_note_items_product_id ON public.credit_note_items(product_id);
CREATE INDEX idx_credit_transactions_customer_id ON public.credit_transactions(customer_id);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);