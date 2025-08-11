-- Fresh Database Setup Script
-- Generated at: Thu Aug  7 22:47:03 +04 2025
-- This script creates a complete database from scratch

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- From: 20250129_add_invoice_settings.sql
-- ==========================================
-- Add new invoice settings to system_settings table
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at) VALUES
-- Invoice Number Reset
('invoice_number_reset', '"never"', 'string', 'Invoice number reset frequency: never, monthly, fiscal_year, annually', false, NOW(), NOW()),

-- Invoice Format Template
('invoice_format_template', '"standard"', 'string', 'Invoice template format: standard, custom_basic', false, NOW(), NOW()),

-- Rounding Method
('rounding_method', '"no_rounding"', 'string', 'Rounding method for calculations: no_rounding, nearest, up, down', false, NOW(), NOW()),

-- Rounding Precision
('rounding_precision', '"0.01"', 'string', 'Rounding precision: 0.01, 0.25, 0.50, 1.00', false, NOW(), NOW()),

-- Default Invoice Notes
('default_invoice_notes', '"Thank you for your business"', 'string', 'Default notes to include on invoices', false, NOW(), NOW()),

-- Include Company Logo
('include_company_logo', 'true', 'boolean', 'Whether to include company logo on invoices', false, NOW(), NOW())

ON CONFLICT (setting_key) DO NOTHING; 

-- From: 20250129_add_missing_system_settings.sql
-- ==========================================
-- Add missing system settings
INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  is_public,
  created_by
) VALUES
-- Address fields (parsed from company_address)
('company_city', '"Tech City"', 'string', 'Company city', true, null),
('company_state', '"TC"', 'string', 'Company state/province', true, null),
('company_zip', '"12345"', 'string', 'Company zip/postal code', true, null),
('company_country', '"USA"', 'string', 'Company country', true, null),

-- Additional settings
('date_format', '"MM/DD/YYYY"', 'string', 'Default date format for the system', true, null),
('time_format', '"12"', 'string', 'Time format (12 or 24 hour)', true, null),
('timezone', '"UTC"', 'string', 'Default timezone', true, null),
('language', '"en"', 'string', 'Default language', true, null),
('enable_signup', 'true', 'boolean', 'Enable user signup feature', true, null),
('require_email_verification', 'true', 'boolean', 'Require email verification for new users', true, null),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout', false, null),
('lockout_duration', '300', 'number', 'Account lockout duration in seconds', false, null),
('password_min_length', '8', 'number', 'Minimum password length', false, null),
('password_require_special', 'true', 'boolean', 'Require special characters in passwords', false, null),
('session_timeout_warning', '300', 'number', 'Session timeout warning in seconds', false, null),
('enable_audit_log', 'true', 'boolean', 'Enable audit logging', false, null),
('backup_retention_days', '30', 'number', 'Number of days to retain backups', false, null),
('enable_api_rate_limiting', 'true', 'boolean', 'Enable API rate limiting', false, null),
('max_file_upload_size', '10485760', 'number', 'Maximum file upload size in bytes', false, null),
('allowed_file_types', '"jpg,jpeg,png,pdf,doc,docx,xls,xlsx"', 'string', 'Allowed file types for uploads', false, null),
('enable_two_factor_auth', 'false', 'boolean', 'Enable two-factor authentication', false, null),
('enable_remember_me', 'true', 'boolean', 'Enable remember me functionality', false, null),
('enable_password_reset', 'true', 'boolean', 'Enable password reset functionality', false, null),
('enable_account_lockout', 'true', 'boolean', 'Enable account lockout after failed attempts', false, null)
ON CONFLICT (setting_key) DO NOTHING; 

-- From: 20250129_add_signup_setting.sql
-- ==========================================
-- Add enable_signup system setting
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
VALUES (
  'enable_signup',
  'true',
  'boolean',
  'Enable user signup functionality',
  true,
  NOW(),
  NOW()
) ON CONFLICT (setting_key) DO NOTHING; 

-- From: 20250129_add_timestamps_to_roles.sql
-- ==========================================
-- Add timestamp columns to roles table
ALTER TABLE public.roles 
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for roles table
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON public.roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing roles to have timestamps (if any exist)
UPDATE public.roles 
SET created_at = NOW(), updated_at = NOW() 
WHERE created_at IS NULL OR updated_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.roles.created_at IS 'Timestamp when the role was created';
COMMENT ON COLUMN public.roles.updated_at IS 'Timestamp when the role was last updated'; 

-- From: 20250129_create_inventory_tables.sql
-- ==========================================
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

-- From: 20250129_fix_get_user_role_function.sql
-- ==========================================
-- Fix the get_user_role function to work with role_id instead of role
-- The profiles table has role_id column, not role column

-- First, drop all RLS policies that depend on get_user_role function
-- This will find and drop ALL policies that reference the function
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies that reference get_user_role function
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE pg_get_expr(qual, polrelid) LIKE '%get_user_role%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s" ON %s.%s', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
END $$;

-- Now drop the function
DROP FUNCTION IF EXISTS public.get_user_role(user_id UUID);

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.name::user_role 
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
$$;

-- Recreate all the RLS policies
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin and manager access" ON public.categories
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.categories
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.units
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.units
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.taxes
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.taxes
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.suppliers
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.suppliers
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.customers
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.customers
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.products
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.products
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.stock_levels
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.stock_levels
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

-- Recreate user_settings and system_settings policies
CREATE POLICY "Admins can view all user settings" ON public.user_settings
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Add any other policies that might exist
-- These are common policies that might be missing
CREATE POLICY "Users can manage their own settings" ON public.user_settings
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can read public system settings" ON public.system_settings
  FOR SELECT USING (is_public = true AND auth.uid() IS NOT NULL);

-- Test the function (optional)
-- SELECT public.get_user_role('your-user-id-here'); 

-- From: 20250129_insert_credit_note_items.sql
-- ==========================================
-- Insert mock data for credit note items
-- Run this in Supabase SQL Editor

-- Insert credit note items for the credit notes we created
INSERT INTO public.credit_note_items (
  credit_note_id,
  product_id,
  credit_quantity,
  unit_price,
  discount,
  tax,
  returned_quantity,
  condition_on_return,
  return_to_stock,
  batch_number,
  quality_notes
) VALUES
-- Items for CN-0001 (Damaged goods return)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0001'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD001' LIMIT 1),
  2,
  900.00,
  0.00,
  90.00,
  2,
  'damaged',
  false,
  'BATCH-2024-001',
  'Items damaged during shipping - not returnable to stock'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0001'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD002' LIMIT 1),
  3,
  25.00,
  0.00,
  2.50,
  3,
  'damaged',
  false,
  'BATCH-2024-002',
  'Packaging damaged - items may be salvageable'
),

-- Items for CN-0002 (Wrong items shipped)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0002'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD003' LIMIT 1),
  1,
  120.00,
  10.00,
  11.00,
  1,
  'good',
  true,
  'BATCH-2024-003',
  'Wrong item shipped - returned in good condition'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0002'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD001' LIMIT 1),
  2,
  35.00,
  0.00,
  3.50,
  2,
  'good',
  true,
  'BATCH-2024-004',
  'Correct item - returned to stock'
),

-- Items for CN-0003 (Order cancellation)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0003'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD002' LIMIT 1),
  1,
  150.00,
  0.00,
  15.00,
  0,
  'good',
  false,
  'BATCH-2024-005',
  'Order cancelled before shipping - no physical return'
),

-- Items for CN-0004 (Quality issues)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0004'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD001' LIMIT 1),
  3,
  900.00,
  10.00,
  89.00,
  3,
  'defective',
  false,
  'BATCH-2024-006',
  'Quality control issues - batch recall'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0004'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD003' LIMIT 1),
  5,
  25.00,
  0.00,
  2.50,
  5,
  'defective',
  false,
  'BATCH-2024-007',
  'Defective batch - not returnable to stock'
),

-- Items for CN-0005 (Pricing error)
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0005'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD002' LIMIT 1),
  1,
  35.00,
  7.00,
  2.80,
  0,
  'good',
  false,
  'BATCH-2024-008',
  'Pricing error - no physical return needed'
),
(
  (SELECT id FROM public.credit_notes WHERE credit_note_number = 'CN-0005'),
  (SELECT id FROM public.products WHERE sku_code = 'PRD003' LIMIT 1),
  1,
  120.00,
  0.00,
  12.00,
  0,
  'good',
  false,
  'BATCH-2024-009',
  'Pricing error correction'
)
ON CONFLICT DO NOTHING; 

-- From: 20250129_insert_credit_notes_data.sql
-- ==========================================
-- Insert mock data for credit notes
-- Run this in Supabase SQL Editor

-- Insert mock credit notes with correct column structure
INSERT INTO public.credit_notes (
  credit_note_number,
  customer_id,
  credit_date,
  reason,
  reason_description,
  status,
  approval_required,
  subtotal,
  tax_amount,
  discount_amount,
  total_amount,
  refund_method,
  affects_inventory,
  notes,
  created_by
) VALUES
(
  'CN-0001',
  (SELECT id FROM public.customers WHERE name = 'Retail Store ABC' LIMIT 1),
  '2024-01-15',
  'damage',
  'Items returned due to damage during shipping',
  'approved',
  false,
  500.00,
  50.00,
  0.00,
  550.00,
  'credit_account',
  true,
  'Customer returned damaged goods - shipping damage confirmed',
  (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin') LIMIT 1)
),
(
  'CN-0002',
  (SELECT id FROM public.customers WHERE name = 'Wholesale Distributor XYZ' LIMIT 1),
  '2024-01-20',
  'billing_error',
  'Wrong items were shipped and billed',
  'processed',
  false,
  200.00,
  20.00,
  10.00,
  210.00,
  'bank_transfer',
  true,
  'Incorrect items were shipped - customer requested refund',
  (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin') LIMIT 1)
),
(
  'CN-0003',
  (SELECT id FROM public.customers WHERE name = 'Online Shop Express' LIMIT 1),
  '2024-01-25',
  'cancellation',
  'Order cancelled by customer before shipping',
  'pending',
  true,
  120.00,
  12.00,
  0.00,
  132.00,
  'credit_account',
  false,
  'Order cancelled by customer - no inventory impact',
  (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin') LIMIT 1)
),
(
  'CN-0004',
  (SELECT id FROM public.customers WHERE name = 'Regional Distributor North' LIMIT 1),
  '2024-01-28',
  'damage',
  'Quality control issues identified in batch',
  'approved',
  false,
  800.00,
  80.00,
  10.00,
  870.00,
  'store_credit',
  true,
  'Quality control issues identified - batch recall',
  (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin') LIMIT 1)
),
(
  'CN-0005',
  (SELECT id FROM public.customers WHERE name = 'Local Business Solutions' LIMIT 1),
  '2024-01-30',
  'billing_error',
  'Incorrect pricing applied to order',
  'processed',
  false,
  75.00,
  7.50,
  7.00,
  75.50,
  'cash',
  false,
  'Pricing error corrected - customer overcharged',
  (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin') LIMIT 1)
)
ON CONFLICT (credit_note_number) DO NOTHING; 

-- From: 20250129_insert_mock_data.sql
-- ==========================================
-- Insert mock data for suppliers and customers
-- Run this in Supabase SQL Editor

-- Insert mock suppliers
INSERT INTO public.suppliers (
  name, 
  contact_name, 
  email, 
  phone, 
  address, 
  payment_terms, 
  tax_id, 
  notes, 
  is_active
) VALUES
(
  'Tech Solutions Inc.',
  'John Smith',
  'john.smith@techsolutions.com',
  '+1-555-0123',
  '123 Business Ave, Tech City, TC 12345',
  'Net 30',
  'TAX-001',
  'Primary technology supplier',
  true
),
(
  'Global Manufacturing Co.',
  'Sarah Johnson',
  'sarah.j@globalmfg.com',
  '+1-555-0456',
  '456 Industrial Blvd, Manufacturing District, MD 67890',
  'Net 45',
  'TAX-002',
  'Reliable manufacturing partner',
  true
),
(
  'Quality Parts Ltd.',
  'Mike Chen',
  'mike.chen@qualityparts.com',
  '+1-555-0789',
  '789 Quality Street, Parts Town, PT 11111',
  'Net 30',
  'TAX-003',
  'High-quality components supplier',
  true
),
(
  'Fast Logistics Express',
  'Lisa Rodriguez',
  'lisa.r@fastlogistics.com',
  '+1-555-0321',
  '321 Speed Way, Logistics Center, LC 22222',
  'Net 15',
  'TAX-004',
  'Fast shipping and delivery',
  true
),
(
  'Premium Materials Corp.',
  'David Wilson',
  'david.w@premiummaterials.com',
  '+1-555-0654',
  '654 Premium Road, Materials City, MC 33333',
  'Net 60',
  'TAX-005',
  'Premium grade materials',
  true
)
ON CONFLICT (name) DO NOTHING;

-- Insert mock customers
INSERT INTO public.customers (
  name,
  email,
  phone,
  billing_address,
  shipping_address,
  tax_id,
  notes,
  credit_limit,
  current_credit,
  customer_type
) VALUES
(
  'Retail Store ABC',
  'contact@retailabc.com',
  '+1-555-1001',
  '{"street": "100 Main Street", "city": "Downtown", "state": "CA", "zip": "90210"}',
  '{"street": "100 Main Street", "city": "Downtown", "state": "CA", "zip": "90210"}',
  'CUST-001',
  'Regular retail customer',
  5000.00,
  0.00,
  'retail'
),
(
  'Wholesale Distributor XYZ',
  'orders@wholesalexyz.com',
  '+1-555-2002',
  '{"street": "200 Commerce Blvd", "city": "Business District", "state": "NY", "zip": "10001"}',
  '{"street": "201 Warehouse Ave", "city": "Industrial Zone", "state": "NY", "zip": "10002"}',
  'CUST-002',
  'Major wholesale partner',
  25000.00,
  1500.00,
  'wholesale'
),
(
  'Online Shop Express',
  'support@onlineshop.com',
  '+1-555-3003',
  '{"street": "300 Digital Lane", "city": "Tech Hub", "state": "TX", "zip": "75001"}',
  '{"street": "300 Digital Lane", "city": "Tech Hub", "state": "TX", "zip": "75001"}',
  'CUST-003',
  'E-commerce customer',
  10000.00,
  2500.00,
  'retail'
),
(
  'Regional Distributor North',
  'sales@regionaldist.com',
  '+1-555-4004',
  '{"street": "400 Regional Way", "city": "Distribution Center", "state": "IL", "zip": "60001"}',
  '{"street": "401 Logistics Drive", "city": "Logistics Park", "state": "IL", "zip": "60002"}',
  'CUST-004',
  'Regional distribution partner',
  15000.00,
  0.00,
  'distributor'
),
(
  'Local Business Solutions',
  'info@localbusiness.com',
  '+1-555-5005',
  '{"street": "500 Local Street", "city": "Small Town", "state": "FL", "zip": "32001"}',
  '{"street": "500 Local Street", "city": "Small Town", "state": "FL", "zip": "32001"}',
  'CUST-005',
  'Local business customer',
  3000.00,
  500.00,
  'retail'
)
ON CONFLICT (name) DO NOTHING; 

-- From: 20250129_insert_system_settings.sql
-- ==========================================
-- Delete existing system settings and insert new ones
-- Run this in Supabase SQL Editor

-- First, delete all existing system settings
DELETE FROM public.system_settings;

-- Insert default system settings with correct column names
INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  is_public,
  created_by
) VALUES
('company_name', '"Versal WMS"', 'string', 'Company name for the warehouse management system', true, null),
('company_address', '"123 Business Street, Tech City, TC 12345, USA"', 'string', 'Company address for invoices and reports', true, null),
('company_phone', '"+1-555-0123"', 'string', 'Company phone number', true, null),
('company_email', '"info@versalwms.com"', 'string', 'Company email address', true, null),
('default_currency', '"USD"', 'string', 'Default currency for the system', true, null),
('tax_rate', '10.0', 'number', 'Default tax rate percentage', true, null),
('invoice_prefix', '"INV"', 'string', 'Prefix for invoice numbers', true, null),
('credit_note_prefix', '"CN"', 'string', 'Prefix for credit note numbers', true, null),
('purchase_order_prefix', '"PO"', 'string', 'Prefix for purchase order numbers', true, null),
('grn_prefix', '"GRN"', 'string', 'Prefix for goods received note numbers', true, null),
('low_stock_threshold', '10', 'number', 'Default low stock threshold', false, null),
('auto_reorder_enabled', 'false', 'boolean', 'Enable automatic reordering', false, null),
('email_notifications_enabled', 'true', 'boolean', 'Enable email notifications', false, null),
('backup_frequency', '"daily"', 'string', 'System backup frequency', false, null),
('session_timeout', '3600', 'number', 'Session timeout in seconds', false, null),
('tax_calculation_method', '"exclusive"', 'string', 'How tax is calculated (inclusive or exclusive)', false, null),
('auto_backup_enabled', 'true', 'boolean', 'Enable automatic database backups', false, null),
('low_stock_global_threshold', '10', 'number', 'Global low stock threshold percentage', false, null),
('enable_multi_warehouse', 'false', 'boolean', 'Enable multi-warehouse functionality', false, null),
('grn_auto_numbering', 'true', 'boolean', 'Auto-generate GRN numbers', false, null),
('po_auto_numbering', 'true', 'boolean', 'Auto-generate Purchase Order numbers', false, null),
('invoice_auto_numbering', 'true', 'boolean', 'Auto-generate Invoice numbers', false, null); 

-- From: 20250129_insert_test_products.sql
-- ==========================================
-- Insert test products for debugging
-- Run this in Supabase SQL Editor

-- First, ensure we have some categories and units
INSERT INTO public.categories (name, description, is_active) VALUES
('Electronics', 'Electronic devices and accessories', true),
('Clothing', 'Apparel and fashion items', true),
('Home & Garden', 'Home improvement and garden supplies', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.units (name, abbreviation, description) VALUES
('Piece', 'pc', 'Individual items'),
('Kilogram', 'kg', 'Weight measurement'),
('Liter', 'L', 'Volume measurement')
ON CONFLICT (name) DO NOTHING;

-- Insert test products
INSERT INTO public.products (
  name, 
  description, 
  sku_code, 
  category_id, 
  unit_id, 
  cost_price, 
  selling_price, 
  is_active
) VALUES
(
  'Premium Wireless Headphones',
  'High-quality wireless headphones with noise cancellation',
  'PRD001',
  (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
  (SELECT id FROM public.units WHERE name = 'Piece' LIMIT 1),
  45.00,
  89.99,
  true
),
(
  'Cotton T-Shirt',
  'Comfortable cotton t-shirt in various sizes',
  'PRD002',
  (SELECT id FROM public.categories WHERE name = 'Clothing' LIMIT 1),
  (SELECT id FROM public.units WHERE name = 'Piece' LIMIT 1),
  8.50,
  19.99,
  true
),
(
  'Garden Hose',
  'Durable garden hose for outdoor use',
  'PRD003',
  (SELECT id FROM public.categories WHERE name = 'Home & Garden' LIMIT 1),
  (SELECT id FROM public.units WHERE name = 'Piece' LIMIT 1),
  12.00,
  24.99,
  true
)
ON CONFLICT (sku_code) DO NOTHING;

-- Insert stock levels for the products
INSERT INTO public.stock_levels (product_id, quantity_on_hand, quantity_reserved) VALUES
(
  (SELECT id FROM public.products WHERE sku_code = 'PRD001'),
  50,
  5
),
(
  (SELECT id FROM public.products WHERE sku_code = 'PRD002'),
  200,
  10
),
(
  (SELECT id FROM public.products WHERE sku_code = 'PRD003'),
  75,
  0
)
ON CONFLICT (product_id) DO UPDATE SET
  quantity_on_hand = EXCLUDED.quantity_on_hand,
  quantity_reserved = EXCLUDED.quantity_reserved; 

-- From: 20250129_rename_wholesale_permissions.sql
-- ==========================================
-- Migration: Rename wholesale permissions to sale permissions
-- Date: 2025-01-29

-- Update Administrator role permissions
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{}', 
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value = 'wholesale_orders_view' THEN '"sale_orders_view"'
        WHEN value = 'wholesale_orders_create' THEN '"sale_orders_create"'
        WHEN value = 'wholesale_orders_edit' THEN '"sale_orders_edit"'
        WHEN value = 'wholesale_orders_delete' THEN '"sale_orders_delete"'
        WHEN value = 'wholesale_billing_view' THEN '"sale_invoices_view"'
        WHEN value = 'wholesale_billing_create' THEN '"sale_invoices_create"'
        WHEN value = 'wholesale_billing_edit' THEN '"sale_invoices_edit"'
        WHEN value = 'wholesale_billing_delete' THEN '"sale_invoices_delete"'
        ELSE value
      END
    )
    FROM jsonb_array_elements(permissions) AS value
  )
)
WHERE name = 'Administrator';

-- Update Manager role permissions (if exists)
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{}', 
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value = 'wholesale_orders_view' THEN '"sale_orders_view"'
        WHEN value = 'wholesale_orders_create' THEN '"sale_orders_create"'
        WHEN value = 'wholesale_orders_edit' THEN '"sale_orders_edit"'
        WHEN value = 'wholesale_orders_delete' THEN '"sale_orders_delete"'
        WHEN value = 'wholesale_billing_view' THEN '"sale_invoices_view"'
        WHEN value = 'wholesale_billing_create' THEN '"sale_invoices_create"'
        WHEN value = 'wholesale_billing_edit' THEN '"sale_invoices_edit"'
        WHEN value = 'wholesale_billing_delete' THEN '"sale_invoices_delete"'
        ELSE value
      END
    )
    FROM jsonb_array_elements(permissions) AS value
  )
)
WHERE name = 'Manager';

-- Update Staff role permissions (if exists)
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{}', 
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value = 'wholesale_orders_view' THEN '"sale_orders_view"'
        WHEN value = 'wholesale_orders_create' THEN '"sale_orders_create"'
        WHEN value = 'wholesale_orders_edit' THEN '"sale_orders_edit"'
        WHEN value = 'wholesale_orders_delete' THEN '"sale_orders_delete"'
        WHEN value = 'wholesale_billing_view' THEN '"sale_invoices_view"'
        WHEN value = 'wholesale_billing_create' THEN '"sale_invoices_create"'
        WHEN value = 'wholesale_billing_edit' THEN '"sale_invoices_edit"'
        WHEN value = 'wholesale_billing_delete' THEN '"sale_invoices_delete"'
        ELSE value
      END
    )
    FROM jsonb_array_elements(permissions) AS value
  )
)
WHERE name = 'Staff'; 

-- From: 20250129_update_inventory_permissions.sql
-- ==========================================
-- Update Inventory Permissions to Granular Level
-- This script replaces the old inventory permissions with new granular ones

-- First, let's see what permissions currently exist for inventory
SELECT 
  name,
  permissions
FROM roles 
WHERE permissions::text LIKE '%inventory%';

-- Update Administrator role with new granular inventory permissions
UPDATE roles 
SET permissions = array_remove(permissions, 'inventory_manage') || ARRAY[
  'inventory_stock_view',
  'inventory_stock_manage', 
  'inventory_movements_view',
  'inventory_movements_create',
  'inventory_locations_view',
  'inventory_locations_manage'
]
WHERE name = 'Administrator' AND 'inventory_manage' = ANY(permissions);

-- Update Manager role with limited inventory permissions
UPDATE roles 
SET permissions = array_remove(permissions, 'inventory_manage') || ARRAY[
  'inventory_stock_view',
  'inventory_stock_manage',
  'inventory_movements_view',
  'inventory_movements_create',
  'inventory_locations_view'
]
WHERE name = 'Manager' AND 'inventory_manage' = ANY(permissions);

-- Update Staff role with view-only inventory permissions
UPDATE roles 
SET permissions = array_remove(permissions, 'inventory_manage') || ARRAY[
  'inventory_stock_view',
  'inventory_movements_view',
  'inventory_locations_view'
]
WHERE name = 'Staff' AND 'inventory_manage' = ANY(permissions);

-- Verify the updates were applied correctly
SELECT 
  name,
  jsonb_array_length(permissions) as permission_count,
  permissions
FROM roles 
WHERE permissions::text LIKE '%inventory%'
ORDER BY name; 

-- From: 20250129_update_inventory_permissions_final.sql
-- ==========================================
-- Update Inventory Permissions to Final Granular Level
-- This script updates roles with the new granular inventory permissions

-- First, let's see what permissions currently exist for inventory
SELECT 
  name,
  permissions
FROM roles 
WHERE permissions::text LIKE '%inventory%';

-- Update Administrator role with all inventory permissions
UPDATE roles 
SET permissions = array_remove(permissions, 'inventory_manage') || ARRAY[
  'inventory_view',
  'inventory_stock_view',
  'inventory_stock_manage', 
  'inventory_movements_view',
  'inventory_movements_create',
  'inventory_locations_view',
  'inventory_locations_manage'
]
WHERE name = 'Administrator' AND ('inventory_manage' = ANY(permissions) OR 'inventory_view' = ANY(permissions));

-- Update Manager role with limited inventory permissions
UPDATE roles 
SET permissions = array_remove(permissions, 'inventory_manage') || ARRAY[
  'inventory_view',
  'inventory_stock_view',
  'inventory_stock_manage',
  'inventory_movements_view',
  'inventory_movements_create',
  'inventory_locations_view'
]
WHERE name = 'Manager' AND ('inventory_manage' = ANY(permissions) OR 'inventory_view' = ANY(permissions));

-- Update Staff role with view-only inventory permissions
UPDATE roles 
SET permissions = array_remove(permissions, 'inventory_manage') || ARRAY[
  'inventory_view',
  'inventory_stock_view',
  'inventory_movements_view',
  'inventory_locations_view'
]
WHERE name = 'Staff' AND ('inventory_manage' = ANY(permissions) OR 'inventory_view' = ANY(permissions));

-- Verify the updates were applied correctly
SELECT 
  name,
  jsonb_array_length(permissions) as permission_count,
  permissions
FROM roles 
WHERE permissions::text LIKE '%inventory%'
ORDER BY name; 

-- From: 20250129_update_permission_format.sql
-- ==========================================
-- Migration: Update permission format from colon to underscore
-- Date: 2025-01-29

-- Update Administrator role permissions
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{}', 
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value = 'dashboard:read' THEN '"dashboard_view"'
        WHEN value = 'products:read' THEN '"products_view"'
        WHEN value = 'products:write' THEN '"products_create"'
        WHEN value = 'products:edit' THEN '"products_edit"'
        WHEN value = 'products:delete' THEN '"products_delete"'
        WHEN value = 'categories:read' THEN '"categories_view"'
        WHEN value = 'categories:write' THEN '"categories_create"'
        WHEN value = 'categories:edit' THEN '"categories_edit"'
        WHEN value = 'categories:delete' THEN '"categories_delete"'
        WHEN value = 'suppliers:read' THEN '"suppliers_view"'
        WHEN value = 'suppliers:write' THEN '"suppliers_create"'
        WHEN value = 'suppliers:edit' THEN '"suppliers_edit"'
        WHEN value = 'suppliers:delete' THEN '"suppliers_delete"'
        WHEN value = 'customers:read' THEN '"customers_view"'
        WHEN value = 'customers:write' THEN '"customers_create"'
        WHEN value = 'customers:edit' THEN '"customers_edit"'
        WHEN value = 'customers:delete' THEN '"customers_delete"'
        WHEN value = 'units:read' THEN '"units_view"'
        WHEN value = 'units:write' THEN '"units_create"'
        WHEN value = 'units:edit' THEN '"units_edit"'
        WHEN value = 'units:delete' THEN '"units_delete"'
        WHEN value = 'taxes:read' THEN '"taxes_view"'
        WHEN value = 'taxes:write' THEN '"taxes_create"'
        WHEN value = 'taxes:edit' THEN '"taxes_edit"'
        WHEN value = 'taxes:delete' THEN '"taxes_delete"'
        WHEN value = 'purchase_orders:read' THEN '"purchase_orders_view"'
        WHEN value = 'purchase_orders:write' THEN '"purchase_orders_create"'
        WHEN value = 'purchase_orders:edit' THEN '"purchase_orders_edit"'
        WHEN value = 'purchase_orders:delete' THEN '"purchase_orders_delete"'
        WHEN value = 'grn:read' THEN '"grn_view"'
        WHEN value = 'grn:write' THEN '"grn_create"'
        WHEN value = 'grn:edit' THEN '"grn_edit"'
        WHEN value = 'grn:delete' THEN '"grn_delete"'
        WHEN value = 'inventory:read' THEN '"inventory_view"'
        WHEN value = 'inventory:write' THEN '"inventory_create"'
        WHEN value = 'inventory:edit' THEN '"inventory_edit"'
        WHEN value = 'inventory:delete' THEN '"inventory_delete"'
        WHEN value = 'reports:read' THEN '"reports_view"'
        WHEN value = 'reports:write' THEN '"reports_export"'
        WHEN value = 'settings:read' THEN '"settings_view"'
        WHEN value = 'settings:write' THEN '"settings_edit"'
        WHEN value = 'users:read' THEN '"users_view"'
        WHEN value = 'users:write' THEN '"users_create"'
        WHEN value = 'users:edit' THEN '"users_edit"'
        WHEN value = 'users:delete' THEN '"users_delete"'
        WHEN value = 'barcode:read' THEN '"barcode_view"'
        WHEN value = 'barcode:write' THEN '"barcode_create"'
        WHEN value = 'barcode:edit' THEN '"barcode_print"'
        WHEN value = 'backup:read' THEN '"backup_view"'
        WHEN value = 'backup:write' THEN '"backup_create"'
        WHEN value = 'backup:edit' THEN '"backup_restore"'
        WHEN value = 'credit_notes:read' THEN '"credit_notes_view"'
        WHEN value = 'credit_notes:write' THEN '"credit_notes_create"'
        WHEN value = 'credit_notes:edit' THEN '"credit_notes_edit"'
        WHEN value = 'credit_notes:delete' THEN '"credit_notes_delete"'
        ELSE value
      END
    )
    FROM jsonb_array_elements(permissions) AS value
  )
)
WHERE name = 'Administrator';

-- Update Manager role permissions
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{}', 
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value = 'dashboard:read' THEN '"dashboard_view"'
        WHEN value = 'products:read' THEN '"products_view"'
        WHEN value = 'products:write' THEN '"products_create"'
        WHEN value = 'products:edit' THEN '"products_edit"'
        WHEN value = 'products:delete' THEN '"products_delete"'
        WHEN value = 'categories:read' THEN '"categories_view"'
        WHEN value = 'categories:write' THEN '"categories_create"'
        WHEN value = 'categories:edit' THEN '"categories_edit"'
        WHEN value = 'categories:delete' THEN '"categories_delete"'
        WHEN value = 'suppliers:read' THEN '"suppliers_view"'
        WHEN value = 'suppliers:write' THEN '"suppliers_create"'
        WHEN value = 'suppliers:edit' THEN '"suppliers_edit"'
        WHEN value = 'suppliers:delete' THEN '"suppliers_delete"'
        WHEN value = 'customers:read' THEN '"customers_view"'
        WHEN value = 'customers:write' THEN '"customers_create"'
        WHEN value = 'customers:edit' THEN '"customers_edit"'
        WHEN value = 'customers:delete' THEN '"customers_delete"'
        WHEN value = 'units:read' THEN '"units_view"'
        WHEN value = 'units:write' THEN '"units_create"'
        WHEN value = 'units:edit' THEN '"units_edit"'
        WHEN value = 'units:delete' THEN '"units_delete"'
        WHEN value = 'taxes:read' THEN '"taxes_view"'
        WHEN value = 'taxes:write' THEN '"taxes_create"'
        WHEN value = 'taxes:edit' THEN '"taxes_edit"'
        WHEN value = 'taxes:delete' THEN '"taxes_delete"'
        WHEN value = 'purchase_orders:read' THEN '"purchase_orders_view"'
        WHEN value = 'purchase_orders:write' THEN '"purchase_orders_create"'
        WHEN value = 'purchase_orders:edit' THEN '"purchase_orders_edit"'
        WHEN value = 'purchase_orders:delete' THEN '"purchase_orders_delete"'
        WHEN value = 'grn:read' THEN '"grn_view"'
        WHEN value = 'grn:write' THEN '"grn_create"'
        WHEN value = 'grn:edit' THEN '"grn_edit"'
        WHEN value = 'grn:delete' THEN '"grn_delete"'
        WHEN value = 'inventory:read' THEN '"inventory_view"'
        WHEN value = 'inventory:write' THEN '"inventory_create"'
        WHEN value = 'inventory:edit' THEN '"inventory_edit"'
        WHEN value = 'inventory:delete' THEN '"inventory_delete"'
        WHEN value = 'reports:read' THEN '"reports_view"'
        WHEN value = 'reports:write' THEN '"reports_export"'
        WHEN value = 'settings:read' THEN '"settings_view"'
        WHEN value = 'settings:write' THEN '"settings_edit"'
        WHEN value = 'users:read' THEN '"users_view"'
        WHEN value = 'users:write' THEN '"users_create"'
        WHEN value = 'users:edit' THEN '"users_edit"'
        WHEN value = 'users:delete' THEN '"users_delete"'
        WHEN value = 'barcode:read' THEN '"barcode_view"'
        WHEN value = 'barcode:write' THEN '"barcode_create"'
        WHEN value = 'barcode:edit' THEN '"barcode_print"'
        WHEN value = 'backup:read' THEN '"backup_view"'
        WHEN value = 'backup:write' THEN '"backup_create"'
        WHEN value = 'backup:edit' THEN '"backup_restore"'
        WHEN value = 'credit_notes:read' THEN '"credit_notes_view"'
        WHEN value = 'credit_notes:write' THEN '"credit_notes_create"'
        WHEN value = 'credit_notes:edit' THEN '"credit_notes_edit"'
        WHEN value = 'credit_notes:delete' THEN '"credit_notes_delete"'
        ELSE value
      END
    )
    FROM jsonb_array_elements(permissions) AS value
  )
)
WHERE name = 'Manager';

-- Update Staff role permissions
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{}', 
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value = 'dashboard:read' THEN '"dashboard_view"'
        WHEN value = 'products:read' THEN '"products_view"'
        WHEN value = 'products:write' THEN '"products_create"'
        WHEN value = 'products:edit' THEN '"products_edit"'
        WHEN value = 'products:delete' THEN '"products_delete"'
        WHEN value = 'categories:read' THEN '"categories_view"'
        WHEN value = 'categories:write' THEN '"categories_create"'
        WHEN value = 'categories:edit' THEN '"categories_edit"'
        WHEN value = 'categories:delete' THEN '"categories_delete"'
        WHEN value = 'suppliers:read' THEN '"suppliers_view"'
        WHEN value = 'suppliers:write' THEN '"suppliers_create"'
        WHEN value = 'suppliers:edit' THEN '"suppliers_edit"'
        WHEN value = 'suppliers:delete' THEN '"suppliers_delete"'
        WHEN value = 'customers:read' THEN '"customers_view"'
        WHEN value = 'customers:write' THEN '"customers_create"'
        WHEN value = 'customers:edit' THEN '"customers_edit"'
        WHEN value = 'customers:delete' THEN '"customers_delete"'
        WHEN value = 'units:read' THEN '"units_view"'
        WHEN value = 'units:write' THEN '"units_create"'
        WHEN value = 'units:edit' THEN '"units_edit"'
        WHEN value = 'units:delete' THEN '"units_delete"'
        WHEN value = 'taxes:read' THEN '"taxes_view"'
        WHEN value = 'taxes:write' THEN '"taxes_create"'
        WHEN value = 'taxes:edit' THEN '"taxes_edit"'
        WHEN value = 'taxes:delete' THEN '"taxes_delete"'
        WHEN value = 'purchase_orders:read' THEN '"purchase_orders_view"'
        WHEN value = 'purchase_orders:write' THEN '"purchase_orders_create"'
        WHEN value = 'purchase_orders:edit' THEN '"purchase_orders_edit"'
        WHEN value = 'purchase_orders:delete' THEN '"purchase_orders_delete"'
        WHEN value = 'grn:read' THEN '"grn_view"'
        WHEN value = 'grn:write' THEN '"grn_create"'
        WHEN value = 'grn:edit' THEN '"grn_edit"'
        WHEN value = 'grn:delete' THEN '"grn_delete"'
        WHEN value = 'inventory:read' THEN '"inventory_view"'
        WHEN value = 'inventory:write' THEN '"inventory_create"'
        WHEN value = 'inventory:edit' THEN '"inventory_edit"'
        WHEN value = 'inventory:delete' THEN '"inventory_delete"'
        WHEN value = 'reports:read' THEN '"reports_view"'
        WHEN value = 'reports:write' THEN '"reports_export"'
        WHEN value = 'settings:read' THEN '"settings_view"'
        WHEN value = 'settings:write' THEN '"settings_edit"'
        WHEN value = 'users:read' THEN '"users_view"'
        WHEN value = 'users:write' THEN '"users_create"'
        WHEN value = 'users:edit' THEN '"users_edit"'
        WHEN value = 'users:delete' THEN '"users_delete"'
        WHEN value = 'barcode:read' THEN '"barcode_view"'
        WHEN value = 'barcode:write' THEN '"barcode_create"'
        WHEN value = 'barcode:edit' THEN '"barcode_print"'
        WHEN value = 'backup:read' THEN '"backup_view"'
        WHEN value = 'backup:write' THEN '"backup_create"'
        WHEN value = 'backup:edit' THEN '"backup_restore"'
        WHEN value = 'credit_notes:read' THEN '"credit_notes_view"'
        WHEN value = 'credit_notes:write' THEN '"credit_notes_create"'
        WHEN value = 'credit_notes:edit' THEN '"credit_notes_edit"'
        WHEN value = 'credit_notes:delete' THEN '"credit_notes_delete"'
        ELSE value
      END
    )
    FROM jsonb_array_elements(permissions) AS value
  )
)
WHERE name = 'Staff'; 

-- From: 20250130_complete_inventory_audit_trail.sql
-- ==========================================
-- Complete Inventory Audit Trail Migration
-- This migration implements comprehensive inventory tracking across all modules

-- Create sale invoices table for wholesale billing functionality
CREATE TABLE IF NOT EXISTS public.sale_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'online', 'credit', 'credit_note')),
  payment_reference TEXT,
  payment_date DATE,
  credit_note_id UUID,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_due DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  affects_inventory BOOLEAN DEFAULT true,
  inventory_processed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sale invoice items table
CREATE TABLE IF NOT EXISTS public.sale_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.sale_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount + tax) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transaction type enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM ('purchase', 'sale', 'adjustment', 'return', 'transfer');
  END IF;
END $$;

-- Create invoice status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'paid', 'overdue', 'cancelled', 'returned', 'exchanged', 'partially_returned');
  END IF;
END $$;

-- Function to handle sales order inventory updates
CREATE OR REPLACE FUNCTION public.handle_sales_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When sales order status changes to 'confirmed', 'processing', or 'shipped'
  IF NEW.status IN ('confirmed', 'processing', 'shipped') AND 
     OLD.status NOT IN ('confirmed', 'processing', 'shipped') THEN
    
    -- Create inventory transaction for each item
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
      soi.product_id,
      'sale',
      -soi.quantity, -- Negative for sales (reduces inventory)
      'sales_order',
      NEW.id,
      'Sales Order: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
    
  -- When sales order is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
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
      soi.product_id,
      'adjustment',
      soi.quantity, -- Positive to restore inventory
      'sales_order',
      NEW.id,
      'Order Cancelled - Inventory Restored: ' || NEW.order_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for sales order inventory updates
CREATE TRIGGER on_sales_order_status_change
  AFTER UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_order_inventory();

-- Function to handle sale invoice inventory updates
CREATE OR REPLACE FUNCTION public.handle_sale_invoice_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When sale invoice status changes to 'paid' or 'processing'
  IF NEW.status IN ('paid', 'processing') AND 
     OLD.status NOT IN ('paid', 'processing') THEN
    
    -- Create inventory transaction for each item
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
      sii.product_id,
      'sale',
      -sii.quantity, -- Negative for sales (reduces inventory)
      'sale_invoice',
      NEW.id,
      'Sale via Invoice: ' || NEW.invoice_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sale_invoice_items sii
    WHERE sii.invoice_id = NEW.id;
    
  -- When sale invoice is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
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
      sii.product_id,
      'adjustment',
      sii.quantity, -- Positive to restore inventory
      'sale_invoice',
      NEW.id,
      'Invoice Cancelled - Inventory Restored: ' || NEW.invoice_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.sale_invoice_items sii
    WHERE sii.invoice_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for sale invoice inventory updates
CREATE TRIGGER on_sale_invoice_status_change
  AFTER UPDATE ON public.sale_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_invoice_inventory();

-- Function to handle purchase order inventory transactions
CREATE OR REPLACE FUNCTION public.handle_purchase_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When purchase order status changes to 'confirmed' or 'processing'
  IF NEW.status IN ('confirmed', 'processing') AND 
     OLD.status NOT IN ('confirmed', 'processing') THEN
    
    -- Create inventory transaction for each item (reserved inventory)
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
      poi.product_id,
      'purchase',
      poi.quantity, -- Positive for purchases (increases inventory)
      'purchase_order',
      NEW.id,
      'Purchase via Order: ' || NEW.order_number || ' - Status: ' || NEW.status,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id;
    
  -- When purchase order is cancelled, reverse the inventory transaction
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Create reversal inventory transaction for each item
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
      poi.product_id,
      'adjustment',
      -poi.quantity, -- Negative to reverse the purchase
      'purchase_order',
      NEW.id,
      'Order Cancelled - Inventory Reversed: ' || NEW.order_number,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for purchase order inventory updates
CREATE TRIGGER on_purchase_order_status_change
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_order_inventory();

-- Function to handle stock level adjustment transactions
CREATE OR REPLACE FUNCTION public.handle_stock_level_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  previous_quantity INTEGER;
  quantity_change INTEGER;
BEGIN
  -- Get the previous quantity
  IF TG_OP = 'UPDATE' THEN
    previous_quantity := OLD.quantity_on_hand;
  ELSE
    previous_quantity := 0;
  END IF;
  
  -- Calculate quantity change
  quantity_change := NEW.quantity_on_hand - previous_quantity;
  
  -- Only create transaction if there's an actual change
  IF quantity_change != 0 THEN
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.product_id,
      'adjustment',
      quantity_change,
      'stock_level',
      NEW.id,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Initial stock level set'
        WHEN quantity_change > 0 THEN 'Stock level increased'
        ELSE 'Stock level decreased'
      END,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for stock level adjustments
CREATE TRIGGER on_stock_level_change
  AFTER INSERT OR UPDATE ON public.stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_level_adjustment();

-- Function to handle initial stock quantity for new products
CREATE OR REPLACE FUNCTION public.handle_new_product_initial_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new product is created, create initial stock level if initial_quantity is provided
  IF NEW.initial_quantity IS NOT NULL AND NEW.initial_quantity > 0 THEN
    -- Insert initial stock level
    INSERT INTO public.stock_levels (
      product_id,
      quantity_on_hand,
      quantity_reserved,
      quantity_available,
      created_by
    ) VALUES (
      NEW.id,
      NEW.initial_quantity,
      0,
      NEW.initial_quantity,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
    
    -- Create inventory transaction for initial stock
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.id,
      'adjustment',
      NEW.initial_quantity,
      'product_creation',
      NEW.id,
      'Initial stock quantity set on product creation: ' || NEW.name,
      COALESCE(NEW.created_by, (SELECT id FROM public.profiles WHERE role_id = (SELECT id FROM public.roles WHERE name = 'admin' LIMIT 1) LIMIT 1))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for new product initial stock
CREATE TRIGGER on_new_product_created
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_product_initial_stock();

-- Add initial_quantity column to products table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'initial_quantity') THEN
    ALTER TABLE public.products ADD COLUMN initial_quantity INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create indexes for better performance on inventory transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_type ON public.inventory_transactions(reference_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_id ON public.inventory_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON public.inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_transaction_type ON public.inventory_transactions(transaction_type);

-- Create indexes for sales and purchase orders
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_sale_invoices_status ON public.sale_invoices(status);

-- Verify the triggers were created successfully
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name IN (
  'on_sales_order_status_change',
  'on_purchase_order_status_change', 
  'on_stock_level_change',
  'on_new_product_created',
  'on_sale_invoice_status_change'
)
ORDER BY trigger_name; 

-- From: 20250130_insert_credit_notes_mock_data.sql
-- ==========================================
-- Insert mock credit notes data
-- This will populate the credit_notes and credit_note_items tables with realistic data

DO $$
DECLARE
    customer1_id UUID;
    customer2_id UUID;
    customer3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get customer IDs
    SELECT id INTO customer1_id FROM public.customers WHERE name = 'Retail Store ABC' LIMIT 1;
    SELECT id INTO customer2_id FROM public.customers WHERE name = 'Wholesale Distributor XYZ' LIMIT 1;
    SELECT id INTO customer3_id FROM public.customers WHERE name = 'Online Shop Express' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert credit notes
    INSERT INTO public.credit_notes (
        credit_note_number,
        sales_order_id,
        customer_id,
        credit_date,
        reason,
        reason_description,
        status,
        approval_required,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        refund_method,
        refund_processed,
        affects_inventory,
        inventory_processed,
        notes,
        internal_notes,
        created_by
    ) VALUES
    (
        'CN-2024-001',
        NULL,
        customer1_id,
        CURRENT_DATE - INTERVAL '3 days',
        'return',
        'Customer returned damaged goods',
        'approved',
        true,
        500.00,
        90.00,
        0.00,
        590.00,
        'credit_account',
        true,
        true,
        true,
        'Credit note for returned damaged items',
        'Items were damaged during shipping',
        user_id
    ),
    (
        'CN-2024-002',
        NULL,
        customer2_id,
        CURRENT_DATE - INTERVAL '1 day',
        'billing_error',
        'Incorrect pricing applied',
        'pending',
        true,
        200.00,
        36.00,
        0.00,
        236.00,
        'credit_account',
        false,
        false,
        false,
        'Credit note for billing error correction',
        'Price was incorrectly calculated',
        user_id
    ),
    (
        'CN-2024-003',
        NULL,
        customer3_id,
        CURRENT_DATE - INTERVAL '5 days',
        'damage',
        'Products arrived damaged',
        'processed',
        true,
        300.00,
        54.00,
        0.00,
        354.00,
        'bank_transfer',
        true,
        true,
        true,
        'Credit note for damaged products',
        'Products were damaged in transit',
        user_id
    ),
    (
        'CN-2024-004',
        NULL,
        customer1_id,
        CURRENT_DATE,
        'discount',
        'Loyalty discount applied',
        'draft',
        false,
        150.00,
        27.00,
        0.00,
        177.00,
        'store_credit',
        false,
        false,
        false,
        'Credit note for loyalty discount',
        'Customer loyalty program discount',
        user_id
    ),
    (
        'CN-2024-005',
        NULL,
        customer2_id,
        CURRENT_DATE - INTERVAL '2 days',
        'cancellation',
        'Order cancelled by customer',
        'approved',
        true,
        400.00,
        72.00,
        0.00,
        472.00,
        'credit_account',
        false,
        true,
        false,
        'Credit note for cancelled order',
        'Customer cancelled order before shipping',
        user_id
    )
    ON CONFLICT (credit_note_number) DO NOTHING;
    
    RAISE NOTICE 'Credit notes inserted successfully';
END $$; 

-- From: 20250130_insert_grn_mock_data.sql
-- ==========================================
-- Insert mock GRN data
-- This will populate the good_receive_notes and good_receive_note_items tables with realistic data

DO $$
DECLARE
    po1_id UUID;
    po2_id UUID;
    po3_id UUID;
    supplier1_id UUID;
    supplier2_id UUID;
    supplier3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get purchase order IDs
    SELECT id INTO po1_id FROM public.purchase_orders WHERE order_number = 'PO-2024-001' LIMIT 1;
    SELECT id INTO po2_id FROM public.purchase_orders WHERE order_number = 'PO-2024-002' LIMIT 1;
    SELECT id INTO po3_id FROM public.purchase_orders WHERE order_number = 'PO-2024-004' LIMIT 1;
    
    -- Get supplier IDs
    SELECT id INTO supplier1_id FROM public.suppliers WHERE name = 'Tech Solutions Inc.' LIMIT 1;
    SELECT id INTO supplier2_id FROM public.suppliers WHERE name = 'Global Manufacturing Co.' LIMIT 1;
    SELECT id INTO supplier3_id FROM public.suppliers WHERE name = 'Quality Parts Ltd.' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert GRNs
    INSERT INTO public.good_receive_notes (
        grn_number,
        purchase_order_id,
        supplier_id,
        received_date,
        received_by,
        status,
        total_received_items,
        notes,
        quality_check_status,
        warehouse_location,
        subtotal,
        tax_amount,
        total_amount,
        created_by
    ) VALUES
    (
        'GRN-2024-001',
        po1_id,
        supplier1_id,
        CURRENT_DATE - INTERVAL '2 days',
        user_id,
        'completed',
        4,
        'Tech supplies received in good condition',
        'passed',
        'Main Warehouse',
        2000.00,
        360.00,
        2360.00,
        user_id
    ),
    (
        'GRN-2024-002',
        po2_id,
        supplier2_id,
        CURRENT_DATE - INTERVAL '1 day',
        user_id,
        'partial',
        3,
        'Partial delivery - remaining items pending',
        'partial',
        'Secondary Storage',
        1500.00,
        270.00,
        1770.00,
        user_id
    ),
    (
        'GRN-2024-003',
        po3_id,
        supplier1_id,
        CURRENT_DATE - INTERVAL '5 days',
        user_id,
        'completed',
        4,
        'Quality parts received and inspected',
        'passed',
        'Main Warehouse',
        1800.00,
        324.00,
        2124.00,
        user_id
    ),
    (
        'GRN-2024-004',
        po1_id,
        supplier3_id,
        CURRENT_DATE,
        user_id,
        'draft',
        2,
        'Draft GRN for review',
        'pending',
        'Store Front',
        800.00,
        144.00,
        944.00,
        user_id
    ),
    (
        'GRN-2024-005',
        po2_id,
        supplier2_id,
        CURRENT_DATE - INTERVAL '3 days',
        user_id,
        'rejected',
        1,
        'Rejected due to quality issues',
        'failed',
        'Main Warehouse',
        500.00,
        90.00,
        590.00,
        user_id
    )
    ON CONFLICT (grn_number) DO NOTHING;
    
    -- Insert GRN items for GRN-2024-001
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product1_id,
        4,
        4,
        0,
        500.00,
        'BATCH-001',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '6 months',
        'All items passed quality check',
        'Main Warehouse'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-001'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-002
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product2_id,
        7,
        3,
        0,
        500.00,
        'BATCH-002',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '3 months',
        'Partial delivery - remaining 4 items pending',
        'Secondary Storage'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-002'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-003
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product3_id,
        4,
        4,
        0,
        450.00,
        'BATCH-003',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '4 months',
        'All items passed quality check',
        'Main Warehouse'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-003'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-004
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product4_id,
        2,
        2,
        0,
        400.00,
        'BATCH-004',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '2 months',
        'Draft GRN - pending approval',
        'Store Front'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-004'
    ON CONFLICT DO NOTHING;
    
    -- Insert GRN items for GRN-2024-005
    INSERT INTO public.good_receive_note_items (
        grn_id,
        product_id,
        ordered_quantity,
        received_quantity,
        rejected_quantity,
        unit_cost,
        batch_number,
        expiry_date,
        manufacturing_date,
        quality_notes,
        storage_location
    )
    SELECT 
        grn.id,
        product5_id,
        1,
        1,
        1,
        500.00,
        'BATCH-005',
        CURRENT_DATE + INTERVAL '1 year',
        CURRENT_DATE - INTERVAL '1 month',
        'Item rejected due to quality issues',
        'Main Warehouse'
    FROM public.good_receive_notes grn
    WHERE grn.grn_number = 'GRN-2024-005'
    ON CONFLICT DO NOTHING;
    
END $$; 

-- From: 20250130_insert_purchase_orders_mock_data.sql
-- ==========================================
-- Insert mock purchase orders data
-- This will populate the purchase_orders and purchase_order_items tables with realistic data

DO $$
DECLARE
    supplier1_id UUID;
    supplier2_id UUID;
    supplier3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get supplier IDs
    SELECT id INTO supplier1_id FROM public.suppliers WHERE name = 'Tech Solutions Inc.' LIMIT 1;
    SELECT id INTO supplier2_id FROM public.suppliers WHERE name = 'Global Manufacturing Co.' LIMIT 1;
    SELECT id INTO supplier3_id FROM public.suppliers WHERE name = 'Quality Parts Ltd.' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert purchase orders
    INSERT INTO public.purchase_orders (
        order_number,
        supplier_id,
        order_date,
        expected_delivery_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        notes,
        created_by
    ) VALUES
    (
        'PO-2024-001',
        supplier1_id,
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '5 days',
        'pending',
        2000.00,
        360.00,
        100.00,
        2260.00,
        'Regular tech supplies order',
        user_id
    ),
    (
        'PO-2024-002',
        supplier2_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '3 days',
        'approved',
        3500.00,
        630.00,
        175.00,
        3955.00,
        'Manufacturing materials order',
        user_id
    ),
    (
        'PO-2024-003',
        supplier3_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '7 days',
        'draft',
        1200.00,
        216.00,
        60.00,
        1356.00,
        'Quality parts order - draft',
        user_id
    ),
    (
        'PO-2024-004',
        supplier1_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '2 days',
        'received',
        1800.00,
        324.00,
        90.00,
        2034.00,
        'Completed order - received',
        user_id
    ),
    (
        'PO-2024-005',
        supplier2_id,
        CURRENT_DATE - INTERVAL '15 days',
        CURRENT_DATE - INTERVAL '5 days',
        'cancelled',
        2500.00,
        450.00,
        125.00,
        2825.00,
        'Cancelled due to supplier issues',
        user_id
    )
    ON CONFLICT (order_number) DO NOTHING;
    
    -- Insert purchase order items for PO-2024-001
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        4,
        500.00,
        100.00,
        360.00,
        2260.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-001' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-002
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product2_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        7,
        500.00,
        175.00,
        630.00,
        3955.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-002' AND p.id = product2_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-003
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product3_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        400.00,
        60.00,
        216.00,
        1356.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-003' AND p.id = product3_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-004
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product4_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        4,
        450.00,
        90.00,
        324.00,
        2034.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-004' AND p.id = product4_id
    ON CONFLICT DO NOTHING;
    
    -- Insert purchase order items for PO-2024-005
    INSERT INTO public.purchase_order_items (
        purchase_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        cost_price,
        discount,
        tax,
        total
    )
    SELECT 
        po.id,
        product5_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        5,
        500.00,
        125.00,
        450.00,
        2825.00
    FROM public.purchase_orders po, public.products p
    WHERE po.order_number = 'PO-2024-005' AND p.id = product5_id
    ON CONFLICT DO NOTHING;
    
END $$; 

-- From: 20250130_insert_sale_invoices_mock_data.sql
-- ==========================================
-- Insert mock sale invoices data
-- This will populate the sale_invoices and sale_invoice_items tables with realistic data

DO $$
DECLARE
    customer1_id UUID;
    customer2_id UUID;
    customer3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get customer IDs
    SELECT id INTO customer1_id FROM public.customers WHERE name = 'Retail Store ABC' LIMIT 1;
    SELECT id INTO customer2_id FROM public.customers WHERE name = 'Wholesale Distributor XYZ' LIMIT 1;
    SELECT id INTO customer3_id FROM public.customers WHERE name = 'Online Shop Express' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert sale invoices
    INSERT INTO public.sale_invoices (
        bill_number,
        customer_id,
        billing_date,
        due_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        amount_due,
        payment_method,
        payment_reference,
        payment_date,
        notes,
        created_by
    ) VALUES
    (
        'INV-2024-001',
        customer1_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '25 days',
        'paid',
        1500.00,
        270.00,
        75.00,
        1695.00,
        1695.00,
        0.00,
        'bank_transfer',
        'REF-001',
        CURRENT_DATE - INTERVAL '3 days',
        'Invoice for retail store order',
        user_id
    ),
    (
        'INV-2024-002',
        customer2_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '27 days',
        'sent',
        2500.00,
        450.00,
        125.00,
        2825.00,
        0.00,
        2825.00,
        NULL,
        NULL,
        NULL,
        'Wholesale invoice - payment pending',
        user_id
    ),
    (
        'INV-2024-003',
        customer3_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '5 days',
        'overdue',
        800.00,
        144.00,
        40.00,
        904.00,
        0.00,
        904.00,
        NULL,
        NULL,
        NULL,
        'Online order invoice - overdue',
        user_id
    ),
    (
        'INV-2024-004',
        customer1_id,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '29 days',
        'draft',
        1200.00,
        216.00,
        60.00,
        1356.00,
        0.00,
        1356.00,
        NULL,
        NULL,
        NULL,
        'Draft invoice for review',
        user_id
    ),
    (
        'INV-2024-005',
        customer2_id,
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '23 days',
        'partial',
        1800.00,
        324.00,
        90.00,
        2034.00,
        1000.00,
        1034.00,
        'cash',
        'REF-002',
        CURRENT_DATE - INTERVAL '5 days',
        'Partial payment received',
        user_id
    )
    ON CONFLICT (bill_number) DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-001
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        750.00,
        75.00,
        270.00,
        1695.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-001' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-002
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product2_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        5,
        500.00,
        125.00,
        450.00,
        2825.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-002' AND p.id = product2_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-003
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product3_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        400.00,
        40.00,
        144.00,
        904.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-003' AND p.id = product3_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-004
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product4_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        400.00,
        60.00,
        216.00,
        1356.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-004' AND p.id = product4_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sale invoice items for INV-2024-005
    INSERT INTO public.sale_invoice_items (
        sale_invoice_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        si.id,
        product5_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        4,
        450.00,
        90.00,
        324.00,
        2034.00
    FROM public.sale_invoices si, public.products p
    WHERE si.bill_number = 'INV-2024-005' AND p.id = product5_id
    ON CONFLICT DO NOTHING;
    
END $$; 

-- From: 20250130_insert_sales_orders_mock_data.sql
-- ==========================================
-- Insert mock sales orders data
-- This will populate the sales_orders and sales_order_items tables with realistic data

-- First, let's get some customer and product IDs to reference
DO $$
DECLARE
    customer1_id UUID;
    customer2_id UUID;
    customer3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
    user_id UUID;
BEGIN
    -- Get customer IDs
    SELECT id INTO customer1_id FROM public.customers WHERE name = 'Retail Store ABC' LIMIT 1;
    SELECT id INTO customer2_id FROM public.customers WHERE name = 'Wholesale Distributor XYZ' LIMIT 1;
    SELECT id INTO customer3_id FROM public.customers WHERE name = 'Online Shop Express' LIMIT 1;
    
    -- Get product IDs (first 5 products)
    SELECT id INTO product1_id FROM public.products LIMIT 1;
    SELECT id INTO product2_id FROM public.products OFFSET 1 LIMIT 1;
    SELECT id INTO product3_id FROM public.products OFFSET 2 LIMIT 1;
    SELECT id INTO product4_id FROM public.products OFFSET 3 LIMIT 1;
    SELECT id INTO product5_id FROM public.products OFFSET 4 LIMIT 1;
    
    -- Get a user ID for created_by
    SELECT id INTO user_id FROM public.profiles LIMIT 1;
    
    -- Insert sales orders
    INSERT INTO public.sales_orders (
        order_number,
        customer_id,
        order_date,
        delivery_date,
        status,
        subtotal,
        tax_amount,
        discount_amount,
        shipping_amount,
        total_amount,
        notes,
        created_by
    ) VALUES
    (
        'SO-2024-001',
        customer1_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '3 days',
        'sent',
        1500.00,
        270.00,
        75.00,
        50.00,
        1745.00,
        'Regular order for retail store',
        user_id
    ),
    (
        'SO-2024-002',
        customer2_id,
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '7 days',
        'paid',
        2500.00,
        450.00,
        125.00,
        0.00,
        2825.00,
        'Wholesale order with bulk discount',
        user_id
    ),
    (
        'SO-2024-003',
        customer3_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '2 days',
        'overdue',
        800.00,
        144.00,
        40.00,
        25.00,
        929.00,
        'Online order - payment pending',
        user_id
    ),
    (
        'SO-2024-004',
        customer1_id,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '5 days',
        'draft',
        1200.00,
        216.00,
        60.00,
        30.00,
        1386.00,
        'Draft order for review',
        user_id
    ),
    (
        'SO-2024-005',
        customer2_id,
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '1 day',
        'cancelled',
        1800.00,
        324.00,
        90.00,
        0.00,
        2034.00,
        'Cancelled due to stock unavailability',
        user_id
    )
    ON CONFLICT (order_number) DO NOTHING;
    
    -- Insert sales order items for SO-2024-001
    INSERT INTO public.sales_order_items (
        sales_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        so.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        500.00,
        25.00,
        90.00,
        1065.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-001' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.sales_order_items (
        sales_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        so.id,
        product2_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        1,
        500.00,
        50.00,
        90.00,
        540.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-001' AND p.id = product2_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-002
    INSERT INTO public.sales_order_items (
        sales_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        so.id,
        product3_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        5,
        500.00,
        125.00,
        450.00,
        2825.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-002' AND p.id = product3_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-003
    INSERT INTO public.sales_order_items (
        sales_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        so.id,
        product4_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        2,
        400.00,
        40.00,
        144.00,
        929.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-003' AND p.id = product4_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-004
    INSERT INTO public.sales_order_items (
        sales_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        so.id,
        product5_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        400.00,
        60.00,
        216.00,
        1386.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-004' AND p.id = product5_id
    ON CONFLICT DO NOTHING;
    
    -- Insert sales order items for SO-2024-005
    INSERT INTO public.sales_order_items (
        sales_order_id,
        product_id,
        product_name,
        sku_code,
        hsn_code,
        quantity,
        unit_price,
        discount,
        tax,
        total
    )
    SELECT 
        so.id,
        product1_id,
        p.name,
        p.sku_code,
        p.hsn_code,
        3,
        600.00,
        90.00,
        324.00,
        2034.00
    FROM public.sales_orders so, public.products p
    WHERE so.order_number = 'SO-2024-005' AND p.id = product1_id
    ON CONFLICT DO NOTHING;
    
END $$; 

-- From: 20250131_emergency_fix_roles_access.sql
-- ==========================================
-- Emergency Fix: Allow Authenticated Users to Read Roles Table
-- This fixes the application spinning issue after RLS was enabled

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admin only access" ON public.roles;

-- Create a policy that allows all authenticated users to read roles
-- This is needed for the application to fetch user permissions
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create separate policies for write operations (admin only)
CREATE POLICY "Admin only insert access" ON public.roles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only update access" ON public.roles
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only delete access" ON public.roles
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Verify the fix
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'roles'
ORDER BY policyname; 

-- From: 20250131_enable_rls_missing_tables.sql
-- ==========================================
-- Enable RLS for Missing Tables
-- This migration enables Row Level Security for tables that were previously RLS disabled

-- Enable RLS on inventory_movements table
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Enable RLS on locations table
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sale_invoices table
ALTER TABLE public.sale_invoices ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sale_invoice_items table
ALTER TABLE public.sale_invoice_items ENABLE ROW LEVEL SECURITY;

-- Check if roles table exists and enable RLS if it does
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
    ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Note: user_roles is a view, so RLS is handled by the underlying tables

-- Create RLS Policies for inventory_movements (follows same pattern as inventory_transactions)
CREATE POLICY "All authenticated users access" ON public.inventory_movements
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS Policies for locations (admin and manager access, staff read access)
CREATE POLICY "Admin and manager access" ON public.locations
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.locations
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

-- Create RLS Policies for sale_invoices (all authenticated users access)
CREATE POLICY "All authenticated users access" ON public.sale_invoices
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS Policies for sale_invoice_items (all authenticated users access)
CREATE POLICY "All authenticated users access" ON public.sale_invoice_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS Policies for roles table (authenticated users can read, admin only write)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
    -- Allow all authenticated users to read roles (needed for permission checking)
    EXECUTE 'CREATE POLICY "Authenticated users can read roles" ON public.roles FOR SELECT USING (auth.uid() IS NOT NULL)';
    
    -- Only admins can modify roles
    EXECUTE 'CREATE POLICY "Admin only insert access" ON public.roles FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = ''admin'')';
    EXECUTE 'CREATE POLICY "Admin only update access" ON public.roles FOR UPDATE USING (public.get_user_role(auth.uid()) = ''admin'')';
    EXECUTE 'CREATE POLICY "Admin only delete access" ON public.roles FOR DELETE USING (public.get_user_role(auth.uid()) = ''admin'')';
  END IF;
END $$;

-- Note: user_roles is a view, so RLS policies are inherited from underlying tables

-- Verify RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename;

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename, policyname; 

-- From: 20250131_enable_rls_missing_tables_rollback.sql
-- ==========================================
-- Rollback: Disable RLS for Missing Tables
-- This migration can be used to rollback the RLS changes if needed

-- Drop policies first
DROP POLICY IF EXISTS "All authenticated users access" ON public.inventory_movements;
DROP POLICY IF EXISTS "Admin and manager access" ON public.locations;
DROP POLICY IF EXISTS "Staff read access" ON public.locations;
DROP POLICY IF EXISTS "All authenticated users access" ON public.sale_invoices;
DROP POLICY IF EXISTS "All authenticated users access" ON public.sale_invoice_items;
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Admin only insert access" ON public.roles;
DROP POLICY IF EXISTS "Admin only update access" ON public.roles;
DROP POLICY IF EXISTS "Admin only delete access" ON public.roles;
-- Note: user_roles is a view, so no policy to drop

-- Disable RLS on tables
ALTER TABLE public.inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_invoice_items DISABLE ROW LEVEL SECURITY;

-- Check if roles table exists and disable RLS if it does
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles' AND table_schema = 'public') THEN
    ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Note: user_roles is a view, so RLS is handled by underlying tables

-- Verify RLS is disabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename; 

-- From: 20250131_fix_roles_rls_policy.sql
-- ==========================================
-- Fix RLS Policy for Roles Table
-- The current admin-only policy is blocking the application from reading role information
-- We need to allow authenticated users to read roles while maintaining admin-only write access

-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admin only access" ON public.roles;

-- Create separate policies for read and write access
-- Allow all authenticated users to read roles (needed for permission checking)
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can modify roles
CREATE POLICY "Admin only write access" ON public.roles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only update access" ON public.roles
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin only delete access" ON public.roles
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'roles'
ORDER BY policyname; 

-- From: 20250726071655-fdbd07be-c0d9-480d-958f-241f8fe844be.sql
-- ==========================================
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE public.order_status AS ENUM ('draft', 'pending', 'approved', 'received', 'cancelled');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.customer_type AS ENUM ('retail', 'wholesale', 'distributor');
CREATE TYPE public.transaction_type AS ENUM ('purchase', 'sale', 'adjustment', 'transfer');

-- User profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Categories table (hierarchical structure)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  abbreviation TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Taxes table
CREATE TABLE public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate DECIMAL(5,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  is_default BOOLEAN DEFAULT false,
  applied_to TEXT CHECK (applied_to IN ('products', 'services', 'both')) DEFAULT 'products',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms TEXT,
  tax_id TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  billing_address JSONB,
  shipping_address JSONB,
  tax_id TEXT,
  notes TEXT,
  credit_limit DECIMAL(12,2),
  current_credit DECIMAL(12,2) DEFAULT 0,
  customer_type customer_type DEFAULT 'retail',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku_code TEXT UNIQUE NOT NULL,
  barcode TEXT,
  category_id UUID REFERENCES public.categories(id),
  unit_id UUID REFERENCES public.units(id),
  cost_price DECIMAL(12,2),
  selling_price DECIMAL(12,2),
  minimum_stock INTEGER DEFAULT 0,
  maximum_stock INTEGER,
  reorder_point INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Stock levels table
CREATE TABLE public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id)
);

-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status order_status DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Purchase order items table
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  cost_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((quantity * cost_price) - discount + tax) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sales orders/invoices table
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status invoice_status DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sales order items table
CREATE TABLE public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount + tax) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inventory transactions table
CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  quantity_change INTEGER NOT NULL,
  reference_type TEXT, -- 'purchase_order', 'sales_order', 'adjustment'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for all other tables (admin and manager access)
CREATE POLICY "Admin and manager access" ON public.categories
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.categories
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.units
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.units
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.taxes
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.taxes
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.suppliers
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.suppliers
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.customers
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.customers
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.products
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.products
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Admin and manager access" ON public.stock_levels
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff read access" ON public.stock_levels
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "All authenticated users access" ON public.purchase_orders
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.purchase_order_items
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.sales_orders
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.sales_order_items
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.inventory_transactions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_taxes_updated_at
  BEFORE UPDATE ON public.taxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_order_items_updated_at
  BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_items_updated_at
  BEFORE UPDATE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger to automatically manage stock levels
CREATE OR REPLACE FUNCTION public.handle_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update stock levels
  INSERT INTO public.stock_levels (product_id, quantity_on_hand)
  VALUES (NEW.product_id, NEW.quantity_change)
  ON CONFLICT (product_id)
  DO UPDATE SET
    quantity_on_hand = stock_levels.quantity_on_hand + NEW.quantity_change,
    last_updated = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inventory transactions
CREATE TRIGGER on_inventory_transaction
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_transaction();

-- Create indexes for better performance
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_sku_code ON public.products(sku_code);
CREATE INDEX idx_stock_levels_product_id ON public.stock_levels(product_id);
CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX idx_inventory_transactions_product_id ON public.inventory_transactions(product_id);

-- Insert some initial data
INSERT INTO public.units (name, abbreviation, description) VALUES
('Piece', 'pc', 'Individual items'),
('Kilogram', 'kg', 'Weight measurement'),
('Liter', 'L', 'Volume measurement'),
('Meter', 'm', 'Length measurement'),
('Box', 'box', 'Packaging unit'),
('Case', 'case', 'Bulk packaging unit');

INSERT INTO public.taxes (name, rate, is_default, applied_to, description) VALUES
('Standard Tax', 0.1500, true, 'both', 'Standard 15% tax rate'),
('Reduced Tax', 0.0750, false, 'products', 'Reduced 7.5% tax rate for essential items'),
('Zero Tax', 0.0000, false, 'both', 'Tax-free items');

INSERT INTO public.categories (name, description) VALUES
('Electronics', 'Electronic devices and components'),
('Furniture', 'Office and home furniture'),
('Clothing', 'Apparel and accessories'),
('Food & Beverages', 'Consumable items'),
('Office Supplies', 'Stationery and office equipment');

-- From: 20250726071733-13efda89-7b17-45f2-9efd-dd4e348ff786.sql
-- ==========================================
-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update stock levels
  INSERT INTO public.stock_levels (product_id, quantity_on_hand)
  VALUES (NEW.product_id, NEW.quantity_change)
  ON CONFLICT (product_id)
  DO UPDATE SET
    quantity_on_hand = stock_levels.quantity_on_hand + NEW.quantity_change,
    last_updated = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- From: 20250726072529-533169c1-8f6a-4b2a-aaa8-8950a7a56b9b.sql
-- ==========================================
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

-- From: 20250726073004-9d298faf-bebc-4023-adab-29d1799a8a80.sql
-- ==========================================
-- Create Credit Notes table
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE NOT NULL,
  
  -- Reference to original sale
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  
  -- Credit note details
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT CHECK (reason IN ('return', 'damage', 'billing_error', 'discount', 'cancellation', 'price_adjustment', 'other')) NOT NULL,
  reason_description TEXT,
  
  -- Status and processing
  status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'processed', 'cancelled')) DEFAULT 'draft',
  approval_required BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES public.profiles(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  
  -- Financial details
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Processing details
  refund_method TEXT CHECK (refund_method IN ('cash', 'bank_transfer', 'credit_account', 'store_credit', 'exchange')) DEFAULT 'credit_account',
  refund_processed BOOLEAN DEFAULT false,
  refund_date DATE,
  refund_reference TEXT,
  
  -- Inventory impact
  affects_inventory BOOLEAN DEFAULT true,
  inventory_processed BOOLEAN DEFAULT false,
  
  -- Additional info
  notes TEXT,
  internal_notes TEXT,
  
  -- Audit trail
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Credit Note Items table
CREATE TABLE public.credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  
  -- Product and original sale reference
  product_id UUID REFERENCES public.products(id) NOT NULL,
  sales_order_item_id UUID REFERENCES public.sales_order_items(id), -- Reference to original sale item
  
  -- Quantities and pricing
  original_quantity INTEGER, -- Original sold quantity
  credit_quantity INTEGER NOT NULL CHECK (credit_quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS ((credit_quantity * unit_price) - discount + tax) STORED,
  
  -- Return details (if applicable)
  returned_quantity INTEGER DEFAULT 0,
  condition_on_return TEXT CHECK (condition_on_return IN ('good', 'damaged', 'defective', 'expired', 'incomplete')) DEFAULT 'good',
  return_to_stock BOOLEAN DEFAULT true,
  
  -- Quality and location
  batch_number TEXT,
  expiry_date DATE,
  storage_location TEXT,
  quality_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure credit quantity doesn't exceed original if referenced
  CONSTRAINT valid_credit_quantity CHECK (
    sales_order_item_id IS NULL OR 
    credit_quantity <= COALESCE(original_quantity, credit_quantity)
  )
);

-- Create Customer Credit Balance table (to track store credits)
CREATE TABLE public.customer_credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) UNIQUE NOT NULL,
  total_credit_balance DECIMAL(12,2) DEFAULT 0,
  available_credit DECIMAL(12,2) DEFAULT 0,
  used_credit DECIMAL(12,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Credit Transactions table (detailed credit ledger)
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  credit_note_id UUID REFERENCES public.credit_notes(id),
  sales_order_id UUID REFERENCES public.sales_orders(id), -- When credit is used
  
  transaction_type TEXT CHECK (transaction_type IN ('credit_issued', 'credit_used', 'credit_expired', 'credit_adjusted')) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  
  description TEXT,
  reference_number TEXT,
  expiry_date DATE, -- For store credits that expire
  
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Credit Notes tables
CREATE POLICY "All authenticated users access" ON public.credit_notes
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.credit_note_items
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.customer_credit_balances
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users access" ON public.credit_transactions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_credit_notes_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_note_items_updated_at
  BEFORE UPDATE ON public.credit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle credit note inventory updates
CREATE OR REPLACE FUNCTION public.handle_credit_note_inventory()
RETURNS TRIGGER AS $$
DECLARE
  credit_note_record RECORD;
BEGIN
  -- Get credit note details
  SELECT * INTO credit_note_record 
  FROM public.credit_notes 
  WHERE id = NEW.credit_note_id;
  
  -- Only process if credit note affects inventory and is approved
  IF credit_note_record.affects_inventory AND credit_note_record.status = 'approved' AND NEW.return_to_stock THEN
    -- Create inventory transaction for returned goods
    INSERT INTO public.inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      NEW.product_id,
      'adjustment', -- Returns are adjustments
      NEW.returned_quantity,
      'credit_note',
      NEW.credit_note_id,
      'Goods returned via Credit Note: ' || credit_note_record.credit_note_number || 
      ' - Condition: ' || COALESCE(NEW.condition_on_return, 'good'),
      credit_note_record.created_by
    );
    
    -- Mark inventory as processed
    UPDATE public.credit_notes 
    SET inventory_processed = true 
    WHERE id = NEW.credit_note_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for credit note inventory updates
CREATE TRIGGER on_credit_note_item_change
  AFTER INSERT OR UPDATE ON public.credit_note_items
  FOR EACH ROW 
  WHEN (NEW.returned_quantity > 0)
  EXECUTE FUNCTION public.handle_credit_note_inventory();

-- Function to handle customer credit balance updates
CREATE OR REPLACE FUNCTION public.handle_customer_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update customer credit balance
  INSERT INTO public.customer_credit_balances (customer_id, total_credit_balance, available_credit)
  VALUES (NEW.customer_id, NEW.amount, NEW.amount)
  ON CONFLICT (customer_id)
  DO UPDATE SET
    total_credit_balance = customer_credit_balances.total_credit_balance + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        WHEN NEW.transaction_type = 'credit_used' THEN -NEW.amount
        ELSE 0 
      END,
    available_credit = customer_credit_balances.available_credit + 
      CASE 
        WHEN NEW.transaction_type = 'credit_issued' THEN NEW.amount
        WHEN NEW.transaction_type = 'credit_used' THEN -NEW.amount
        ELSE 0 
      END,
    used_credit = customer_credit_balances.used_credit + 
      CASE 
        WHEN NEW.transaction_type = 'credit_used' THEN NEW.amount
        ELSE 0 
      END,
    last_updated = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for customer credit balance updates
CREATE TRIGGER on_credit_transaction
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_customer_credit_balance();

-- Function to automatically create credit transaction when credit note is approved
CREATE OR REPLACE FUNCTION public.handle_credit_note_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to approved and refund method is store credit
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.refund_method = 'store_credit' THEN
    -- Create credit transaction
    INSERT INTO public.credit_transactions (
      customer_id,
      credit_note_id,
      transaction_type,
      amount,
      balance_after,
      description,
      reference_number,
      created_by
    )
    SELECT 
      NEW.customer_id,
      NEW.id,
      'credit_issued',
      NEW.total_amount,
      COALESCE((SELECT available_credit FROM public.customer_credit_balances WHERE customer_id = NEW.customer_id), 0) + NEW.total_amount,
      'Store credit issued via Credit Note: ' || NEW.credit_note_number,
      NEW.credit_note_number,
      NEW.approved_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger for credit note approval
CREATE TRIGGER on_credit_note_approval
  AFTER UPDATE ON public.credit_notes
  FOR EACH ROW 
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION public.handle_credit_note_approval();

-- Create indexes for better performance
CREATE INDEX idx_credit_notes_customer_id ON public.credit_notes(customer_id);
CREATE INDEX idx_credit_notes_sales_order_id ON public.credit_notes(sales_order_id);
CREATE INDEX idx_credit_notes_status ON public.credit_notes(status);
CREATE INDEX idx_credit_notes_credit_date ON public.credit_notes(credit_date);
CREATE INDEX idx_credit_note_items_credit_note_id ON public.credit_note_items(credit_note_id);
CREATE INDEX idx_credit_note_items_product_id ON public.credit_note_items(product_id);
CREATE INDEX idx_credit_transactions_customer_id ON public.credit_transactions(customer_id);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);

-- From: 20250730_add_customer_status_column.sql
-- ==========================================
-- Add is_active column to customers table
ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT true;
-- Update existing customers to be active by default
UPDATE customers SET is_active = true WHERE is_active IS NULL;
-- Add comment to the column
COMMENT ON COLUMN customers.is_active IS 'Whether the customer is active or inactive'; 

-- From: 20250730_add_missing_product_fields.sql
-- ==========================================
-- Add missing fields to products table
-- Migration: 20250730_add_missing_product_fields.sql

-- Add MRP (Maximum Retail Price) field
ALTER TABLE public.products 
ADD COLUMN mrp DECIMAL(12,2);

-- Add Sale Price field (separate from selling_price)
ALTER TABLE public.products 
ADD COLUMN sale_price DECIMAL(12,2);

-- Add Subcategory ID field (for hierarchical categories)
ALTER TABLE public.products 
ADD COLUMN subcategory_id UUID REFERENCES public.categories(id);

-- Create indexes for new fields
CREATE INDEX idx_products_mrp ON public.products(mrp);
CREATE INDEX idx_products_sale_price ON public.products(sale_price);
CREATE INDEX idx_products_subcategory_id ON public.products(subcategory_id);

-- Add comments for documentation
COMMENT ON COLUMN public.products.mrp IS 'Maximum Retail Price (MRP) for the product';
COMMENT ON COLUMN public.products.sale_price IS 'Sale price (different from selling_price/retail price)';
COMMENT ON COLUMN public.products.subcategory_id IS 'Reference to subcategory in the categories table'; 

-- From: 20250730_add_product_fields.sql
-- ==========================================
-- Add new fields to products table
-- Migration: 20250730_add_product_fields.sql

-- Add HSN Code field (mandatory)
ALTER TABLE public.products 
ADD COLUMN hsn_code TEXT NOT NULL DEFAULT '000000';

-- Add Manufacturer Part Number field
ALTER TABLE public.products 
ADD COLUMN manufacturer_part_number TEXT;

-- Add Supplier ID field (mandatory)
ALTER TABLE public.products 
ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);

-- Add Sale Tax ID field (mandatory)
ALTER TABLE public.products 
ADD COLUMN sale_tax_id UUID REFERENCES public.taxes(id);

-- Add Purchase Tax ID field (mandatory)
ALTER TABLE public.products 
ADD COLUMN purchase_tax_id UUID REFERENCES public.taxes(id);

-- Add Manufacturer field
ALTER TABLE public.products 
ADD COLUMN manufacturer TEXT;

-- Add Brand field
ALTER TABLE public.products 
ADD COLUMN brand TEXT;

-- Add Warranty Period field
ALTER TABLE public.products 
ADD COLUMN warranty_period INTEGER;

-- Add Warranty Unit field (days, months, years)
ALTER TABLE public.products 
ADD COLUMN warranty_unit TEXT CHECK (warranty_unit IN ('days', 'months', 'years'));

-- Add Product Tags field
ALTER TABLE public.products 
ADD COLUMN product_tags TEXT[];

-- Add Serialized Product field
ALTER TABLE public.products 
ADD COLUMN is_serialized BOOLEAN DEFAULT false;

-- Add Track Inventory field
ALTER TABLE public.products 
ADD COLUMN track_inventory BOOLEAN DEFAULT true;

-- Add Allow Override Price field
ALTER TABLE public.products 
ADD COLUMN allow_override_price BOOLEAN DEFAULT false;

-- Add Discount Percentage field
ALTER TABLE public.products 
ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Add Warehouse Rack field
ALTER TABLE public.products 
ADD COLUMN warehouse_rack TEXT;

-- Add Unit Conversion field (JSONB for storing conversion rules)
ALTER TABLE public.products 
ADD COLUMN unit_conversions JSONB;

-- Create indexes for better performance
CREATE INDEX idx_products_hsn_code ON public.products(hsn_code);
CREATE INDEX idx_products_supplier_id ON public.products(supplier_id);
CREATE INDEX idx_products_sale_tax_id ON public.products(sale_tax_id);
CREATE INDEX idx_products_purchase_tax_id ON public.products(purchase_tax_id);
CREATE INDEX idx_products_manufacturer ON public.products(manufacturer);
CREATE INDEX idx_products_brand ON public.products(brand);

-- Update existing products to have default HSN code
UPDATE public.products 
SET hsn_code = '000000' 
WHERE hsn_code IS NULL;

-- Make HSN code unique constraint
ALTER TABLE public.products 
ADD CONSTRAINT products_hsn_code_unique UNIQUE (hsn_code);

-- Add comments for documentation
COMMENT ON COLUMN public.products.hsn_code IS 'Harmonized System of Nomenclature code (6-digit uniform code for product classification)';
COMMENT ON COLUMN public.products.manufacturer_part_number IS 'Manufacturer Part Number (MPN) for the product';
COMMENT ON COLUMN public.products.supplier_id IS 'Reference to the supplier/vendor of this product';
COMMENT ON COLUMN public.products.sale_tax_id IS 'Tax applied when selling this product';
COMMENT ON COLUMN public.products.purchase_tax_id IS 'Tax applied when purchasing this product';
COMMENT ON COLUMN public.products.manufacturer IS 'Name of the product manufacturer';
COMMENT ON COLUMN public.products.brand IS 'Product brand name';
COMMENT ON COLUMN public.products.warranty_period IS 'Warranty period duration';
COMMENT ON COLUMN public.products.warranty_unit IS 'Unit for warranty period (days, months, years)';
COMMENT ON COLUMN public.products.product_tags IS 'Array of tags for searching and filtering products';
COMMENT ON COLUMN public.products.is_serialized IS 'Whether this product is serialized (tracked individually)';
COMMENT ON COLUMN public.products.track_inventory IS 'Whether to track inventory for this product';
COMMENT ON COLUMN public.products.allow_override_price IS 'Whether price can be overridden during sales';
COMMENT ON COLUMN public.products.discount_percentage IS 'Default discount percentage for this product';
COMMENT ON COLUMN public.products.warehouse_rack IS 'Warehouse rack location for this product';
COMMENT ON COLUMN public.products.unit_conversions IS 'JSON object storing unit conversion rules'; 

-- From: 20250730_add_supplier_address_columns.sql
-- ==========================================
-- Add billing_address and shipping_address columns to suppliers table as JSONB
ALTER TABLE suppliers ADD COLUMN billing_address JSONB;
ALTER TABLE suppliers ADD COLUMN shipping_address JSONB;

-- Update existing suppliers to use the current address as billing_address
-- Convert the existing TEXT address to a structured JSONB format
UPDATE suppliers SET billing_address = jsonb_build_object(
    'street', address,
    'city', '',
    'state', '',
    'zipCode', '',
    'country', ''
) WHERE billing_address IS NULL AND address IS NOT NULL;

-- Add comments to the columns
COMMENT ON COLUMN suppliers.billing_address IS 'Billing address for the supplier (JSONB with street, city, state, zipCode, country)';
COMMENT ON COLUMN suppliers.shipping_address IS 'Shipping address for the supplier (JSONB with street, city, state, zipCode, country)'; 

-- From: 20250730_add_tax_type_fields.sql
-- ==========================================
-- Add tax type fields to products table
-- Migration: 20250730_add_tax_type_fields.sql

-- Add Sale Tax Type field (inclusive/exclusive)
ALTER TABLE public.products 
ADD COLUMN sale_tax_type TEXT CHECK (sale_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive';

-- Add Purchase Tax Type field (inclusive/exclusive)
ALTER TABLE public.products 
ADD COLUMN purchase_tax_type TEXT CHECK (purchase_tax_type IN ('inclusive', 'exclusive')) DEFAULT 'exclusive';

-- Create indexes for new fields
CREATE INDEX idx_products_sale_tax_type ON public.products(sale_tax_type);
CREATE INDEX idx_products_purchase_tax_type ON public.products(purchase_tax_type);

-- Add comments for documentation
COMMENT ON COLUMN public.products.sale_tax_type IS 'Tax type for sale tax: inclusive or exclusive';
COMMENT ON COLUMN public.products.purchase_tax_type IS 'Tax type for purchase tax: inclusive or exclusive'; 

-- From: 20250730_add_units_status_column.sql
-- ==========================================
-- Add is_active column to units table
ALTER TABLE units ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Update existing units to be active by default
UPDATE units SET is_active = true WHERE is_active IS NULL;

-- Add comment to the column
COMMENT ON COLUMN units.is_active IS 'Whether the unit is active or inactive'; 

-- From: fix_trigger.sql
-- ==========================================
-- Fix the handle_new_user trigger function to use role_id instead of role
-- The profiles table has role_id column, not role column

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    role_uuid UUID;
BEGIN
    -- Try to find the role_id based on the role name from user metadata
    IF NEW.raw_user_meta_data ? 'role' THEN
        SELECT id INTO role_uuid 
        FROM public.roles 
        WHERE name = NEW.raw_user_meta_data->>'role';
    END IF;

    -- Insert into profiles table with correct column names
    INSERT INTO public.profiles (
        id, 
        username, 
        full_name, 
        is_active,
        role_id
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        true,
        role_uuid
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Test the function (optional)
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created'; 

-- From: remove_fk_constraint.sql
-- ==========================================
-- Remove the foreign key constraint from profiles table
-- This will allow us to create users directly in profiles without needing auth.users

-- First, let's check what constraints exist
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='profiles';

-- Remove the foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Verify the constraint is removed
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='profiles'; 

-- From: seed_roles.sql
-- ==========================================
-- Seed Roles Table with Mock Data from UsersPage.tsx
-- Run this script in your Supabase SQL Editor

-- First, let's clear any existing roles (optional - remove if you want to keep existing data)
-- DELETE FROM roles;

-- Insert the Administrator role with all permissions
INSERT INTO roles (name, description, permissions) VALUES (
  'Administrator',
  'Full access to all features and settings',
  '[
    "dashboard_view",
    "products_view", "products_create", "products_edit", "products_delete",
    "categories_view", "categories_create", "categories_edit", "categories_delete",
    "suppliers_view", "suppliers_create", "suppliers_edit", "suppliers_delete",
    "customers_view", "customers_create", "customers_edit", "customers_delete",
    "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit", "purchase_orders_delete",
    "inventory_view", "inventory_manage",
    "reports_view", "reports_export",
    "settings_view", "settings_edit",
    "users_view", "users_create", "users_edit", "users_delete"
  ]'
);

-- Insert the Manager role with limited permissions
INSERT INTO roles (name, description, permissions) VALUES (
  'Manager',
  'Access to most features with limited settings access',
  '[
    "dashboard_view",
    "products_view", "products_create", "products_edit",
    "categories_view", "categories_create", "categories_edit",
    "suppliers_view", "suppliers_create", "suppliers_edit",
    "customers_view", "customers_create", "customers_edit",
    "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit",
    "inventory_view", "inventory_manage",
    "reports_view", "reports_export",
    "settings_view"
  ]'
);

-- Insert the Staff role with basic permissions
INSERT INTO roles (name, description, permissions) VALUES (
  'Staff',
  'Basic access to daily operations',
  '[
    "dashboard_view",
    "products_view",
    "categories_view",
    "suppliers_view",
    "customers_view",
    "purchase_orders_view",
    "inventory_view",
    "reports_view"
  ]'
);

-- Verify the data was inserted correctly
SELECT 
  name,
  description,
  jsonb_array_length(permissions) as permission_count,
  permissions
FROM roles 
ORDER BY name; 

-- From: update_admin_all_permissions.sql
-- ==========================================
-- Update Administrator role with ALL available permissions
-- This ensures the admin role has complete access to all features

UPDATE roles 
SET permissions = '[
  "dashboard_view",
  "products_view", "products_create", "products_edit", "products_delete",
  "categories_view", "categories_create", "categories_edit", "categories_delete",
  "units_view", "units_create", "units_edit", "units_delete",
  "suppliers_view", "suppliers_create", "suppliers_edit", "suppliers_delete",
  "customers_view", "customers_create", "customers_edit", "customers_delete",
  "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit", "purchase_orders_delete",
  "grn_view", "grn_create", "grn_edit", "grn_delete",
  "wholesale_orders_view", "wholesale_orders_create", "wholesale_orders_edit", "wholesale_orders_delete",
  "wholesale_billing_view", "wholesale_billing_create", "wholesale_billing_edit", "wholesale_billing_delete",
  "credit_notes_view", "credit_notes_create", "credit_notes_edit", "credit_notes_delete",
  "inventory_view", "inventory_manage",
  "reports_view", "reports_export",
  "taxes_view", "taxes_create", "taxes_edit", "taxes_delete",
  "barcode_view", "barcode_create", "barcode_print",
  "backup_view", "backup_create", "backup_restore",
  "settings_view", "settings_edit",
  "users_view", "users_create", "users_edit", "users_delete"
]'
WHERE name = 'Administrator';

-- Verify the update was applied correctly
SELECT 
  name,
  description,
  jsonb_array_length(permissions) as permission_count,
  permissions
FROM roles 
WHERE name = 'Administrator'; 

-- From: update_roles_permissions.sql
-- ==========================================
-- Update Existing Roles with Correct Permissions from UsersPage.tsx
-- Run this script in your Supabase SQL Editor

-- Update Administrator role with all permissions
UPDATE roles 
SET permissions = '[
  "dashboard_view",
  "products_view", "products_create", "products_edit", "products_delete",
  "categories_view", "categories_create", "categories_edit", "categories_delete",
  "suppliers_view", "suppliers_create", "suppliers_edit", "suppliers_delete",
  "customers_view", "customers_create", "customers_edit", "customers_delete",
  "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit", "purchase_orders_delete",
  "inventory_view", "inventory_manage",
  "reports_view", "reports_export",
  "settings_view", "settings_edit",
  "users_view", "users_create", "users_edit", "users_delete"
]'
WHERE name = 'Administrator';

-- Update Manager role with limited permissions
UPDATE roles 
SET permissions = '[
  "dashboard_view",
  "products_view", "products_create", "products_edit",
  "categories_view", "categories_create", "categories_edit",
  "suppliers_view", "suppliers_create", "suppliers_edit",
  "customers_view", "customers_create", "customers_edit",
  "purchase_orders_view", "purchase_orders_create", "purchase_orders_edit",
  "inventory_view", "inventory_manage",
  "reports_view", "reports_export",
  "settings_view"
]'
WHERE name = 'Manager';

-- Update Staff role with basic permissions
UPDATE roles 
SET permissions = '[
  "dashboard_view",
  "products_view",
  "categories_view",
  "suppliers_view",
  "customers_view",
  "purchase_orders_view",
  "inventory_view",
  "reports_view"
]'
WHERE name = 'Staff';

-- Verify the updates were applied correctly
SELECT 
  name,
  description,
  jsonb_array_length(permissions) as permission_count,
  permissions
FROM roles 
ORDER BY name; 

