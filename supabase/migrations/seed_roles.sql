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