-- Create table to track serialized inventory per unit
CREATE TABLE IF NOT EXISTS public.product_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','sold','returned','scrapped')),
  grn_item_id UUID REFERENCES public.good_receive_note_items(id) ON DELETE SET NULL,
  sale_invoice_item_id UUID REFERENCES public.sale_invoice_items(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, serial_number)
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_product_serials_product_id ON public.product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_serial_number ON public.product_serials(serial_number);
CREATE INDEX IF NOT EXISTS idx_product_serials_status ON public.product_serials(status);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_product_serials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_serials_updated_at ON public.product_serials;
CREATE TRIGGER update_product_serials_updated_at
  BEFORE UPDATE ON public.product_serials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_serials_updated_at();

-- Enable RLS and add permissive policies consistent with other tables
ALTER TABLE public.product_serials ENABLE ROW LEVEL SECURITY;

-- Basic policy: allow all authenticated users full access (align with current app model)
DROP POLICY IF EXISTS "All authenticated users access" ON public.product_serials;
CREATE POLICY "All authenticated users access" ON public.product_serials
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

