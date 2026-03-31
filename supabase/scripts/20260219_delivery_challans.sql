-- Phase 3: Delivery Challan Module
-- Creates delivery_challans and delivery_challan_items tables
-- DC can be created from Sale Invoice, Sale Order, or standalone

-- ===========================================================================
-- 1. delivery_challans table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.delivery_challans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    dc_number text NOT NULL,
    sale_invoice_id uuid REFERENCES public.sale_invoices(id) ON DELETE SET NULL,
    sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'dispatched', 'delivered', 'invoiced', 'returned', 'partial_return', 'cancelled')),
    dc_date date DEFAULT CURRENT_DATE,
    dispatch_date timestamptz,
    delivery_date timestamptz,
    vehicle_number text,
    driver_name text,
    driver_phone text,
    delivery_address text,
    is_standalone boolean DEFAULT false,
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.delivery_challans IS 'Delivery Challans for dispatching goods to customers';
COMMENT ON COLUMN public.delivery_challans.is_standalone IS 'true if DC created without an invoice (goods sent on approval)';

-- ===========================================================================
-- 2. delivery_challan_items table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.delivery_challan_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_challan_id uuid NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id),
    product_name text,
    sku_code text,
    quantity integer NOT NULL DEFAULT 0,
    dispatched_quantity integer NOT NULL DEFAULT 0,
    unit_price numeric(15,2) DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.delivery_challan_items ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_delivery_challans_sale_invoice_id ON public.delivery_challans(sale_invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_sales_order_id ON public.delivery_challans(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_customer_id ON public.delivery_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_status ON public.delivery_challans(status);
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_dc_id ON public.delivery_challan_items(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_product_id ON public.delivery_challan_items(product_id);

-- ===========================================================================
-- 4. Auto-update timestamps
-- ===========================================================================
CREATE TRIGGER set_delivery_challans_updated_at
    BEFORE UPDATE ON public.delivery_challans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_delivery_challan_items_updated_at
    BEFORE UPDATE ON public.delivery_challan_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 5. RLS Policies
-- ===========================================================================
CREATE POLICY "Allow all for authenticated users" ON public.delivery_challans
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.delivery_challan_items
    FOR ALL USING (auth.role() = 'authenticated');
