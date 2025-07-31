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