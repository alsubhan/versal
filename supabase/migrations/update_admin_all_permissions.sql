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