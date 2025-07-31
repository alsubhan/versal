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