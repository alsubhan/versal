-- Create Locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Inventory Movements table
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  type TEXT CHECK (type IN ('purchase', 'sale', 'adjustment', 'transfer', 'return', 'damage', 'expiry')) NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add location_id to stock_levels table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_levels' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE public.stock_levels ADD COLUMN location_id UUID REFERENCES public.locations(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX idx_locations_name ON public.locations(name);
CREATE INDEX idx_locations_is_active ON public.locations(is_active);
CREATE INDEX idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_type ON public.inventory_movements(type);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at);
CREATE INDEX idx_stock_levels_location_id ON public.stock_levels(location_id);

-- Create triggers for updated_at
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_movements_updated_at
  BEFORE UPDATE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default locations
INSERT INTO public.locations (name, description, address) VALUES
  ('Main Warehouse', 'Primary storage facility', '123 Warehouse St, City, State'),
  ('Store Front', 'Retail store location', '456 Main St, City, State'),
  ('Secondary Storage', 'Additional storage space', '789 Storage Ave, City, State')
ON CONFLICT DO NOTHING; 