-- Add is_active column to units table
ALTER TABLE units ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Update existing units to be active by default
UPDATE units SET is_active = true WHERE is_active IS NULL;

-- Add comment to the column
COMMENT ON COLUMN units.is_active IS 'Whether the unit is active or inactive'; 