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