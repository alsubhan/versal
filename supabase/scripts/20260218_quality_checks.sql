-- Migration: Add Quality Checks (QC) module
-- Phase 1 of warehouse workflow implementation

-- 1. Add 'received' status to grn_status enum
ALTER TYPE public.grn_status ADD VALUE IF NOT EXISTS 'received' AFTER 'partial';

-- 2. Create quality_checks table
CREATE TABLE IF NOT EXISTS public.quality_checks (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    qc_number TEXT NOT NULL UNIQUE,
    grn_id UUID NOT NULL REFERENCES public.good_receive_notes(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES public.profiles(id),
    qc_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT quality_checks_status_check CHECK (
        status IN ('pending', 'in_progress', 'passed', 'failed', 'partial')
    )
);

ALTER TABLE public.quality_checks OWNER TO postgres;

COMMENT ON TABLE public.quality_checks IS 'Quality check records linked to GRNs for inspecting received goods';
COMMENT ON COLUMN public.quality_checks.qc_number IS 'Auto-generated unique QC reference number';
COMMENT ON COLUMN public.quality_checks.grn_id IS 'Reference to the GRN being inspected';
COMMENT ON COLUMN public.quality_checks.inspector_id IS 'User who performed the quality check';
COMMENT ON COLUMN public.quality_checks.status IS 'Status: pending, in_progress, passed, failed, partial';

-- 3. Create quality_check_items table
CREATE TABLE IF NOT EXISTS public.quality_check_items (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    qc_id UUID NOT NULL REFERENCES public.quality_checks(id) ON DELETE CASCADE,
    grn_item_id UUID NOT NULL REFERENCES public.good_receive_note_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    product_name TEXT,
    sku_code TEXT,
    received_quantity INTEGER NOT NULL DEFAULT 0,
    inspected_quantity INTEGER NOT NULL DEFAULT 0,
    passed_quantity INTEGER NOT NULL DEFAULT 0,
    failed_quantity INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT qc_items_inspected_check CHECK (inspected_quantity >= 0),
    CONSTRAINT qc_items_passed_check CHECK (passed_quantity >= 0),
    CONSTRAINT qc_items_failed_check CHECK (failed_quantity >= 0),
    CONSTRAINT qc_items_quantities_check CHECK (passed_quantity + failed_quantity <= inspected_quantity),
    CONSTRAINT qc_items_inspected_limit CHECK (inspected_quantity <= received_quantity)
);

ALTER TABLE public.quality_check_items OWNER TO postgres;

COMMENT ON TABLE public.quality_check_items IS 'Individual items in a quality check with pass/fail quantities';
COMMENT ON COLUMN public.quality_check_items.received_quantity IS 'Quantity received from GRN (copied for reference)';
COMMENT ON COLUMN public.quality_check_items.inspected_quantity IS 'How many units were inspected';
COMMENT ON COLUMN public.quality_check_items.passed_quantity IS 'How many units passed QC';
COMMENT ON COLUMN public.quality_check_items.failed_quantity IS 'How many units failed QC';
COMMENT ON COLUMN public.quality_check_items.failure_reason IS 'Reason for failure (if any items failed)';

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_quality_checks_grn_id ON public.quality_checks(grn_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_status ON public.quality_checks(status);
CREATE INDEX IF NOT EXISTS idx_quality_checks_inspector_id ON public.quality_checks(inspector_id);
CREATE INDEX IF NOT EXISTS idx_quality_check_items_qc_id ON public.quality_check_items(qc_id);
CREATE INDEX IF NOT EXISTS idx_quality_check_items_product_id ON public.quality_check_items(product_id);

-- 5. Add updated_at trigger
CREATE TRIGGER update_quality_checks_updated_at
    BEFORE UPDATE ON public.quality_checks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quality_check_items_updated_at
    BEFORE UPDATE ON public.quality_check_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable RLS (Row Level Security) - same as other tables
ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_check_items ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all operations for authenticated users as per existing pattern)
CREATE POLICY "Allow all operations on quality_checks" ON public.quality_checks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on quality_check_items" ON public.quality_check_items
    FOR ALL USING (true) WITH CHECK (true);
