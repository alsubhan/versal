-- Phase 2: Put Away Module
-- Creates put_aways and put_away_items tables
-- Put Away is created from a completed QC, assigns locations, and triggers stock increase

-- ===========================================================================
-- 1. put_aways table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.put_aways (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    put_away_number text NOT NULL,
    quality_check_id uuid REFERENCES public.quality_checks(id) ON DELETE RESTRICT,
    grn_id uuid REFERENCES public.good_receive_notes(id) ON DELETE RESTRICT,
    assigned_to uuid REFERENCES public.profiles(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    put_away_date date DEFAULT CURRENT_DATE,
    completed_date timestamptz,
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.put_aways ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.put_aways IS 'Put Away records for placing QC-passed goods into storage locations';
COMMENT ON COLUMN public.put_aways.quality_check_id IS 'Link to the quality check that produced these items';
COMMENT ON COLUMN public.put_aways.grn_id IS 'Link to the original GRN';
COMMENT ON COLUMN public.put_aways.assigned_to IS 'Warehouse worker assigned to this put away task';
COMMENT ON COLUMN public.put_aways.completed_date IS 'Timestamp when put away was completed and stock was increased';

-- ===========================================================================
-- 2. put_away_items table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.put_away_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    put_away_id uuid NOT NULL REFERENCES public.put_aways(id) ON DELETE CASCADE,
    quality_check_item_id uuid REFERENCES public.quality_check_items(id),
    product_id uuid NOT NULL REFERENCES public.products(id),
    product_name text,
    sku_code text,
    quantity integer NOT NULL DEFAULT 0,
    placed_quantity integer NOT NULL DEFAULT 0,
    location_id uuid,
    location_name text,
    batch_number text,
    expiry_date date,
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.put_away_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.put_away_items IS 'Individual items within a put away task';
COMMENT ON COLUMN public.put_away_items.quantity IS 'Expected quantity to place (from QC passed quantity)';
COMMENT ON COLUMN public.put_away_items.placed_quantity IS 'Actually placed quantity by the warehouse worker';
COMMENT ON COLUMN public.put_away_items.location_id IS 'Target storage location for this item';

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_put_aways_quality_check_id ON public.put_aways(quality_check_id);
CREATE INDEX IF NOT EXISTS idx_put_aways_grn_id ON public.put_aways(grn_id);
CREATE INDEX IF NOT EXISTS idx_put_aways_status ON public.put_aways(status);
CREATE INDEX IF NOT EXISTS idx_put_aways_assigned_to ON public.put_aways(assigned_to);
CREATE INDEX IF NOT EXISTS idx_put_away_items_put_away_id ON public.put_away_items(put_away_id);
CREATE INDEX IF NOT EXISTS idx_put_away_items_product_id ON public.put_away_items(product_id);
CREATE INDEX IF NOT EXISTS idx_put_away_items_location_id ON public.put_away_items(location_id);

-- ===========================================================================
-- 4. Auto-update timestamps
-- ===========================================================================
CREATE TRIGGER set_put_aways_updated_at
    BEFORE UPDATE ON public.put_aways
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_put_away_items_updated_at
    BEFORE UPDATE ON public.put_away_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 5. RLS Policies
-- ===========================================================================
CREATE POLICY "Allow all for authenticated users" ON public.put_aways
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.put_away_items
    FOR ALL USING (auth.role() = 'authenticated');
