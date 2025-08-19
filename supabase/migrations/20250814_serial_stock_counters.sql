-- Option B: Fast counters for serialized inventory via triggers on product_serials
-- Date: 2025-08-14

-- 1) Add serialized counters to stock_levels (per product/location)
ALTER TABLE public.stock_levels
ADD COLUMN IF NOT EXISTS serialized_available INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS serialized_reserved INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS serialized_sold INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS serialized_returned INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS serialized_scrapped INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.stock_levels.serialized_available IS 'Count of available serialized units';
COMMENT ON COLUMN public.stock_levels.serialized_reserved IS 'Count of reserved serialized units';
COMMENT ON COLUMN public.stock_levels.serialized_sold IS 'Count of sold serialized units';
COMMENT ON COLUMN public.stock_levels.serialized_returned IS 'Count of returned serialized units';
COMMENT ON COLUMN public.stock_levels.serialized_scrapped IS 'Count of scrapped serialized units';

-- Helpful index in product_serials for location lookups
CREATE INDEX IF NOT EXISTS idx_product_serials_location_id ON public.product_serials(location_id);

-- 2) Helper to ensure a stock_levels row exists for (product_id, location_id)
CREATE OR REPLACE FUNCTION public.ensure_stock_level_row(p_product_id UUID, p_location_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.stock_levels (product_id, location_id)
  VALUES (p_product_id, p_location_id)
  ON CONFLICT (product_id, location_id) DO NOTHING;

  SELECT id INTO v_id FROM public.stock_levels
  WHERE product_id = p_product_id AND (location_id IS NOT DISTINCT FROM p_location_id)
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- 3) Helper function to apply a delta to stock_levels counters
CREATE OR REPLACE FUNCTION public.apply_serialized_delta(p_product UUID, p_loc UUID, p_status TEXT, p_delta INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_product IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_stock_level_row(p_product, p_loc);
  
  IF p_status = 'available' THEN
    UPDATE public.stock_levels SET serialized_available = serialized_available + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'reserved' THEN
    UPDATE public.stock_levels SET serialized_reserved = serialized_reserved + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'sold' THEN
    UPDATE public.stock_levels SET serialized_sold = serialized_sold + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'returned' THEN
    UPDATE public.stock_levels SET serialized_returned = serialized_returned + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  ELSIF p_status = 'scrapped' THEN
    UPDATE public.stock_levels SET serialized_scrapped = serialized_scrapped + p_delta
    WHERE product_id = p_product AND (location_id IS NOT DISTINCT FROM p_loc);
  END IF;
END;
$$;

-- 4) Trigger function to sync counters on INSERT/UPDATE/DELETE of product_serials
CREATE OR REPLACE FUNCTION public.product_serials_sync_stock_levels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_loc UUID;
  v_new_loc UUID;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_loc := NEW.location_id;
    v_new_status := NEW.status;
    PERFORM public.apply_serialized_delta(NEW.product_id, v_new_loc, v_new_status, 1);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_loc := OLD.location_id; 
    v_new_loc := NEW.location_id;
    v_old_status := OLD.status; 
    v_new_status := NEW.status;
    -- Reverse old state
    PERFORM public.apply_serialized_delta(OLD.product_id, v_old_loc, v_old_status, -1);
    -- Apply new state
    PERFORM public.apply_serialized_delta(NEW.product_id, v_new_loc, v_new_status, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_loc := OLD.location_id;
    v_old_status := OLD.status;
    PERFORM public.apply_serialized_delta(OLD.product_id, v_old_loc, v_old_status, -1);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_serials_sync_stock_levels_ins ON public.product_serials;
DROP TRIGGER IF EXISTS trg_product_serials_sync_stock_levels_upd ON public.product_serials;
DROP TRIGGER IF EXISTS trg_product_serials_sync_stock_levels_del ON public.product_serials;

CREATE TRIGGER trg_product_serials_sync_stock_levels_ins
AFTER INSERT ON public.product_serials
FOR EACH ROW EXECUTE FUNCTION public.product_serials_sync_stock_levels();

CREATE TRIGGER trg_product_serials_sync_stock_levels_upd
AFTER UPDATE ON public.product_serials
FOR EACH ROW EXECUTE FUNCTION public.product_serials_sync_stock_levels();

CREATE TRIGGER trg_product_serials_sync_stock_levels_del
AFTER DELETE ON public.product_serials
FOR EACH ROW EXECUTE FUNCTION public.product_serials_sync_stock_levels();

-- Notes:
-- - We use IS NOT DISTINCT FROM to match NULL location rows as a key.
-- - This sync keeps counters aligned for serialized products regardless of GRN/Invoice flows.
-- - Non-serialized counts (if any) remain managed by existing flows.
