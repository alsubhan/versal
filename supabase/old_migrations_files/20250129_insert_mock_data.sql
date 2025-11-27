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