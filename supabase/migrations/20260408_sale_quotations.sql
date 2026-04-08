-- Sale Quotations Migration
-- Adds sale_quotations and sale_quotation_items tables

-- ==================== ENUM ====================
DO $$ BEGIN
  CREATE TYPE sale_quotation_status AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==================== MAIN TABLE ====================
CREATE TABLE IF NOT EXISTS public.sale_quotations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number    TEXT NOT NULL UNIQUE,
  customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  quotation_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE,
  status              sale_quotation_status NOT NULL DEFAULT 'draft',
  subtotal            NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(15, 2) NOT NULL DEFAULT 0,
  rounding_adjustment NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes               TEXT,
  terms_conditions    TEXT,
  sales_order_id      UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,  -- set on conversion
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS public.sale_quotation_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id        UUID NOT NULL REFERENCES public.sale_quotations(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name        TEXT NOT NULL,
  sku_code            TEXT,
  hsn_code            TEXT,
  quantity            NUMERIC(15, 4) NOT NULL DEFAULT 0,
  unit_price          NUMERIC(15, 4) NOT NULL DEFAULT 0,
  discount            NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax                 NUMERIC(15, 2) NOT NULL DEFAULT 0,
  sale_tax_type       TEXT NOT NULL DEFAULT 'exclusive',
  unit_abbreviation   TEXT NOT NULL DEFAULT '',
  total               NUMERIC(15, 2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_sale_quotations_customer_id   ON public.sale_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_quotations_status        ON public.sale_quotations(status);
CREATE INDEX IF NOT EXISTS idx_sale_quotations_valid_until   ON public.sale_quotations(valid_until);
CREATE INDEX IF NOT EXISTS idx_sale_quotation_items_qtn_id   ON public.sale_quotation_items(quotation_id);

-- ==================== updated_at TRIGGER ====================
CREATE OR REPLACE FUNCTION public.update_sale_quotation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_quotations_updated_at ON public.sale_quotations;
CREATE TRIGGER trg_sale_quotations_updated_at
  BEFORE UPDATE ON public.sale_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_sale_quotation_updated_at();

-- ==================== RLS ====================
ALTER TABLE public.sale_quotations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_quotation_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (app-layer permissions handle role checks)
CREATE POLICY "Authenticated users can manage sale_quotations"
  ON public.sale_quotations FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage sale_quotation_items"
  ON public.sale_quotation_items FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
