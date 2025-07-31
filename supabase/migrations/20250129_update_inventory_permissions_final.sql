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