-- Delete existing system settings and insert new ones
-- Run this in Supabase SQL Editor

-- First, delete all existing system settings
DELETE FROM public.system_settings;

-- Insert default system settings with correct column names
INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  is_public,
  created_by
) VALUES
('company_name', '"Versal WMS"', 'string', 'Company name for the warehouse management system', true, null),
('company_address', '"123 Business Street, Tech City, TC 12345, USA"', 'string', 'Company address for invoices and reports', true, null),
('company_phone', '"+1-555-0123"', 'string', 'Company phone number', true, null),
('company_email', '"info@versalwms.com"', 'string', 'Company email address', true, null),
('default_currency', '"USD"', 'string', 'Default currency for the system', true, null),
('tax_rate', '10.0', 'number', 'Default tax rate percentage', true, null),
('invoice_prefix', '"INV"', 'string', 'Prefix for invoice numbers', true, null),
('credit_note_prefix', '"CN"', 'string', 'Prefix for credit note numbers', true, null),
('purchase_order_prefix', '"PO"', 'string', 'Prefix for purchase order numbers', true, null),
('grn_prefix', '"GRN"', 'string', 'Prefix for goods received note numbers', true, null),
('low_stock_threshold', '10', 'number', 'Default low stock threshold', false, null),
('auto_reorder_enabled', 'false', 'boolean', 'Enable automatic reordering', false, null),
('email_notifications_enabled', 'true', 'boolean', 'Enable email notifications', false, null),
('backup_frequency', '"daily"', 'string', 'System backup frequency', false, null),
('session_timeout', '3600', 'number', 'Session timeout in seconds', false, null),
('tax_calculation_method', '"exclusive"', 'string', 'How tax is calculated (inclusive or exclusive)', false, null),
('auto_backup_enabled', 'true', 'boolean', 'Enable automatic database backups', false, null),
('low_stock_global_threshold', '10', 'number', 'Global low stock threshold percentage', false, null),
('enable_multi_warehouse', 'false', 'boolean', 'Enable multi-warehouse functionality', false, null),
('grn_auto_numbering', 'true', 'boolean', 'Auto-generate GRN numbers', false, null),
('po_auto_numbering', 'true', 'boolean', 'Auto-generate Purchase Order numbers', false, null),
('invoice_auto_numbering', 'true', 'boolean', 'Auto-generate Invoice numbers', false, null); 