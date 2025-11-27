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