-- Phase 5: Return Delivery Challan Module
-- Handles customer returns of previously delivered goods
-- Completing a return increases stock and updates DC status

-- ===========================================================================
-- 1. return_delivery_challans table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.return_delivery_challans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    return_dc_number text NOT NULL,
    delivery_challan_id uuid REFERENCES public.delivery_challans(id) ON DELETE RESTRICT,
    customer_id uuid REFERENCES public.customers(id),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'received', 'inspected', 'completed', 'cancelled')),
    return_date date DEFAULT CURRENT_DATE,
    received_date timestamptz,
    completed_date timestamptz,
    reason text,
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.return_delivery_challans ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.return_delivery_challans IS 'Return delivery challans for handling customer returns';
COMMENT ON COLUMN public.return_delivery_challans.delivery_challan_id IS 'Link to the original delivery challan';

-- ===========================================================================
-- 2. return_delivery_challan_items table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.return_delivery_challan_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    return_dc_id uuid NOT NULL REFERENCES public.return_delivery_challans(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id),
    product_name text,
    sku_code text,
    delivered_quantity integer NOT NULL DEFAULT 0,
    return_quantity integer NOT NULL DEFAULT 0,
    received_quantity integer NOT NULL DEFAULT 0,
    reason text,
    condition text DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'defective', 'expired')),
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.return_delivery_challan_items ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_return_dc_dc_id ON public.return_delivery_challans(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_return_dc_customer_id ON public.return_delivery_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_return_dc_status ON public.return_delivery_challans(status);
CREATE INDEX IF NOT EXISTS idx_return_dc_items_return_dc_id ON public.return_delivery_challan_items(return_dc_id);
CREATE INDEX IF NOT EXISTS idx_return_dc_items_product_id ON public.return_delivery_challan_items(product_id);

-- ===========================================================================
-- 4. Auto-update timestamps
-- ===========================================================================
CREATE TRIGGER set_return_dc_updated_at
    BEFORE UPDATE ON public.return_delivery_challans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_return_dc_items_updated_at
    BEFORE UPDATE ON public.return_delivery_challan_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 5. RLS Policies
-- ===========================================================================
CREATE POLICY "Allow all for authenticated users" ON public.return_delivery_challans
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.return_delivery_challan_items
    FOR ALL USING (auth.role() = 'authenticated');
