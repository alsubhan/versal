-- Add rounding_adjustment column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add rounding_adjustment column to sales_orders table (for consistency)
ALTER TABLE public.sales_orders 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add rounding_adjustment column to good_receive_notes table
ALTER TABLE public.good_receive_notes 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add rounding_adjustment column to credit_notes table
ALTER TABLE public.credit_notes 
ADD COLUMN rounding_adjustment DECIMAL(12,2) DEFAULT 0;

-- Add missing columns to purchase_order_items table
ALTER TABLE public.purchase_order_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN purchase_tax_type TEXT CHECK (purchase_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT,
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Add missing columns to sales_order_items table (for consistency)
ALTER TABLE public.sales_order_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT,
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Add missing columns to good_receive_note_items table
ALTER TABLE public.good_receive_note_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN purchase_tax_type TEXT CHECK (purchase_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT,
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Add missing columns to credit_note_items table
ALTER TABLE public.credit_note_items 
ADD COLUMN product_name TEXT,
ADD COLUMN sku_code TEXT,
ADD COLUMN hsn_code TEXT,
ADD COLUMN sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
ADD COLUMN unit_abbreviation TEXT,
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Create sales_invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status invoice_status DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  rounding_adjustment DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sales_invoice_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sales_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  sku_code TEXT,
  hsn_code TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount + tax) STORED,
  sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive',
  unit_abbreviation TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

-- Create policies for sales_invoices
CREATE POLICY "All authenticated users access" ON public.sales_invoices
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create policies for sales_invoice_items
CREATE POLICY "All authenticated users access" ON public.sales_invoice_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create triggers for new tables
CREATE TRIGGER update_sales_invoices_updated_at
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_invoice_items_updated_at
  BEFORE UPDATE ON public.sales_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for new tables
CREATE INDEX idx_sales_invoices_customer_id ON public.sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_sales_order_id ON public.sales_invoices(sales_order_id);
CREATE INDEX idx_sales_invoice_items_sales_invoice_id ON public.sales_invoice_items(sales_invoice_id); 