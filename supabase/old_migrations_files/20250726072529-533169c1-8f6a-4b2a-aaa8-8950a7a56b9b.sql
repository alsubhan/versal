-- Create Good Receive Notes (GRN) table
CREATE TABLE public.good_receive_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT UNIQUE NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'partial', 'completed', 'rejected')) DEFAULT 'draft',
  total_received_items INTEGER DEFAULT 0,
  notes TEXT,
  quality_check_status TEXT CHECK (quality_check_status IN ('pending', 'passed', 'failed', 'partial')) DEFAULT 'pending',
  warehouse_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create GRN items table
CREATE TABLE public.good_receive_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES public.good_receive_notes(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  ordered_quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL CHECK (received_quantity >= 0),
  rejected_quantity INTEGER DEFAULT 0 CHECK (rejected_quantity >= 0),
  accepted_quantity INTEGER GENERATED ALWAYS AS (received_quantity - rejected_quantity) STORED,
  unit_cost DECIMAL(12,2) NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  manufacturing_date DATE,
  quality_notes TEXT,
  storage_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_quantities CHECK (received_quantity >= rejected_quantity)
);

-- Create user settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Dashboard preferences
  dashboard_layout JSONB DEFAULT '{}',
  default_dashboard_widgets TEXT[] DEFAULT ARRAY['inventory_summary', 'recent_orders', 'low_stock_alerts'],
  
  -- UI preferences
  theme TEXT CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',
  
  -- Inventory preferences
  default_warehouse_location TEXT,
  low_stock_threshold_percentage INTEGER DEFAULT 20,
  enable_barcode_scanning BOOLEAN DEFAULT true,
  auto_generate_sku BOOLEAN DEFAULT true,
  sku_prefix TEXT DEFAULT 'SKU',
  
  -- Order preferences
  default_payment_terms TEXT DEFAULT '30 days',
  auto_create_grn BOOLEAN DEFAULT false,
  require_po_approval BOOLEAN DEFAULT true,
  default_tax_rate UUID REFERENCES public.taxes(id),
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  low_stock_alerts BOOLEAN DEFAULT true,
  order_status_notifications BOOLEAN DEFAULT true,
  daily_report_email BOOLEAN DEFAULT false,
  
  -- Report preferences
  default_report_period TEXT DEFAULT '30_days',
  include_tax_in_reports BOOLEAN DEFAULT true,
  
  -- Security preferences
  session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
  require_password_change_days INTEGER DEFAULT 90,
  
  -- Custom settings (for future extensibility)
  custom_settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create system settings table (for global application settings)
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  setting_type TEXT CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false, -- Whether this setting can be read by non-admin users
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.good_receive_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.good_receive_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for GRN tables
CREATE POLICY "All authenticated users access" ON public.good_receive_notes
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.good_receive_note_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for user settings
CREATE POLICY "Users can manage their own settings" ON public.user_settings
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user settings" ON public.user_settings
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for system settings
CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can read public system settings" ON public.system_settings
  FOR SELECT USING (is_public = true AND auth.uid() IS NOT NULL);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_good_receive_notes_updated_at
  BEFORE UPDATE ON public.good_receive_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_good_receive_note_items_updated_at
  BEFORE UPDATE ON public.good_receive_note_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create user settings on profile creation
CREATE OR REPLACE FUNCTION public.create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger to create default user settings when profile is created
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_user_settings();

-- Create function to automatically update inventory from GRN
CREATE OR REPLACE FUNCTION public.handle_grn_inventory_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if accepted_quantity changed and GRN is completed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.accepted_quantity != NEW.accepted_quantity) THEN
    -- Check if the parent GRN is completed
    IF EXISTS (
      SELECT 1 FROM public.good_receive_notes 
      WHERE id = NEW.grn_id AND status = 'completed'
    ) THEN
      -- Create inventory transaction for received goods
      INSERT INTO public.inventory_transactions (
        product_id,
        transaction_type,
        quantity_change,
        reference_type,
        reference_id,
        notes,
        created_by
      )
      SELECT 
        NEW.product_id,
        'purchase',
        CASE 
          WHEN TG_OP = 'INSERT' THEN NEW.accepted_quantity
          ELSE NEW.accepted_quantity - OLD.accepted_quantity
        END,
        'grn',
        NEW.grn_id,
        'Goods received via GRN: ' || (SELECT grn_number FROM public.good_receive_notes WHERE id = NEW.grn_id),
        (SELECT received_by FROM public.good_receive_notes WHERE id = NEW.grn_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for GRN inventory updates
CREATE TRIGGER on_grn_item_change
  AFTER INSERT OR UPDATE ON public.good_receive_note_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_grn_inventory_update();

-- Create indexes for better performance
CREATE INDEX idx_grn_purchase_order_id ON public.good_receive_notes(purchase_order_id);
CREATE INDEX idx_grn_supplier_id ON public.good_receive_notes(supplier_id);
CREATE INDEX idx_grn_received_date ON public.good_receive_notes(received_date);
CREATE INDEX idx_grn_items_grn_id ON public.good_receive_note_items(grn_id);
CREATE INDEX idx_grn_items_product_id ON public.good_receive_note_items(product_id);
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX idx_system_settings_key ON public.system_settings(setting_key);

-- Insert some default system settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('company_name', '"Your Company Name"', 'string', 'Company name displayed in the application', true),
('company_address', '{"street": "", "city": "", "state": "", "zip": "", "country": ""}', 'json', 'Company address details', true),
('default_currency', '"USD"', 'string', 'Default currency for the application', true),
('tax_calculation_method', '"inclusive"', 'string', 'How tax is calculated (inclusive or exclusive)', false),
('auto_backup_enabled', 'true', 'boolean', 'Enable automatic database backups', false),
('low_stock_global_threshold', '10', 'number', 'Global low stock threshold percentage', false),
('enable_multi_warehouse', 'false', 'boolean', 'Enable multi-warehouse functionality', false),
('grn_auto_numbering', 'true', 'boolean', 'Auto-generate GRN numbers', false),
('po_auto_numbering', 'true', 'boolean', 'Auto-generate Purchase Order numbers', false),
('invoice_auto_numbering', 'true', 'boolean', 'Auto-generate Invoice numbers', false);