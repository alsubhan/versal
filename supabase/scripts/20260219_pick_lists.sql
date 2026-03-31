-- Phase 4: Pick List + Picking Module
-- Creates pick_lists and pick_list_items tables
-- Pick List is generated from a Delivery Challan
-- Completing a pick list decreases stock and dispatches the DC

-- ===========================================================================
-- 1. pick_lists table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.pick_lists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pick_list_number text NOT NULL,
    delivery_challan_id uuid REFERENCES public.delivery_challans(id) ON DELETE RESTRICT,
    assigned_to uuid REFERENCES public.profiles(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    pick_date date DEFAULT CURRENT_DATE,
    completed_date timestamptz,
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pick_lists ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pick_lists IS 'Pick lists for picking items from storage for outbound delivery';
COMMENT ON COLUMN public.pick_lists.delivery_challan_id IS 'Link to the delivery challan this pick list serves';

-- ===========================================================================
-- 2. pick_list_items table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.pick_list_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pick_list_id uuid NOT NULL REFERENCES public.pick_lists(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id),
    product_name text,
    sku_code text,
    quantity integer NOT NULL DEFAULT 0,
    picked_quantity integer NOT NULL DEFAULT 0,
    location_id uuid,
    location_name text,
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pick_list_items ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_pick_lists_dc_id ON public.pick_lists(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_pick_lists_status ON public.pick_lists(status);
CREATE INDEX IF NOT EXISTS idx_pick_lists_assigned_to ON public.pick_lists(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pick_list_items_pick_list_id ON public.pick_list_items(pick_list_id);
CREATE INDEX IF NOT EXISTS idx_pick_list_items_product_id ON public.pick_list_items(product_id);

-- ===========================================================================
-- 4. Auto-update timestamps
-- ===========================================================================
CREATE TRIGGER set_pick_lists_updated_at
    BEFORE UPDATE ON public.pick_lists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_pick_list_items_updated_at
    BEFORE UPDATE ON public.pick_list_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 5. RLS Policies
-- ===========================================================================
CREATE POLICY "Allow all for authenticated users" ON public.pick_lists
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.pick_list_items
    FOR ALL USING (auth.role() = 'authenticated');
