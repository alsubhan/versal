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