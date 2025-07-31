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