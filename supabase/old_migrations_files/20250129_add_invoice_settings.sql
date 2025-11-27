-- Add new invoice settings to system_settings table
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at) VALUES
-- Invoice Number Reset
('invoice_number_reset', '"never"', 'string', 'Invoice number reset frequency: never, monthly, fiscal_year, annually', false, NOW(), NOW()),

-- Invoice Format Template
('invoice_format_template', '"standard"', 'string', 'Invoice template format: standard, custom_basic', false, NOW(), NOW()),

-- Rounding Method
('rounding_method', '"no_rounding"', 'string', 'Rounding method for calculations: no_rounding, nearest, up, down', false, NOW(), NOW()),

-- Rounding Precision
('rounding_precision', '"0.01"', 'string', 'Rounding precision: 0.01, 0.25, 0.50, 1.00', false, NOW(), NOW()),

-- Default Invoice Notes
('default_invoice_notes', '"Thank you for your business"', 'string', 'Default notes to include on invoices', false, NOW(), NOW()),

-- Include Company Logo
('include_company_logo', 'true', 'boolean', 'Whether to include company logo on invoices', false, NOW(), NOW())

ON CONFLICT (setting_key) DO NOTHING; 

-- Ensure public company logo URL setting exists
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
VALUES ('company_logo_url', '"/placeholder.svg"', 'string', 'Public URL for company logo', true, NOW(), NOW())
ON CONFLICT (setting_key) DO NOTHING;