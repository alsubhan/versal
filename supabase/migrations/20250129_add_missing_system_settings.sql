-- Add missing system settings
INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  is_public,
  created_by
) VALUES
-- Address fields (parsed from company_address)
('company_city', '"Tech City"', 'string', 'Company city', true, null),
('company_state', '"TC"', 'string', 'Company state/province', true, null),
('company_zip', '"12345"', 'string', 'Company zip/postal code', true, null),
('company_country', '"USA"', 'string', 'Company country', true, null),

-- Additional settings
('date_format', '"MM/DD/YYYY"', 'string', 'Default date format for the system', true, null),
('time_format', '"12"', 'string', 'Time format (12 or 24 hour)', true, null),
('timezone', '"UTC"', 'string', 'Default timezone', true, null),
('language', '"en"', 'string', 'Default language', true, null),
('enable_signup', 'true', 'boolean', 'Enable user signup feature', true, null),
('require_email_verification', 'true', 'boolean', 'Require email verification for new users', true, null),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout', false, null),
('lockout_duration', '300', 'number', 'Account lockout duration in seconds', false, null),
('password_min_length', '8', 'number', 'Minimum password length', false, null),
('password_require_special', 'true', 'boolean', 'Require special characters in passwords', false, null),
('session_timeout_warning', '300', 'number', 'Session timeout warning in seconds', false, null),
('enable_audit_log', 'true', 'boolean', 'Enable audit logging', false, null),
('backup_retention_days', '30', 'number', 'Number of days to retain backups', false, null),
('enable_api_rate_limiting', 'true', 'boolean', 'Enable API rate limiting', false, null),
('max_file_upload_size', '10485760', 'number', 'Maximum file upload size in bytes', false, null),
('allowed_file_types', '"jpg,jpeg,png,pdf,doc,docx,xls,xlsx"', 'string', 'Allowed file types for uploads', false, null),
('enable_two_factor_auth', 'false', 'boolean', 'Enable two-factor authentication', false, null),
('enable_remember_me', 'true', 'boolean', 'Enable remember me functionality', false, null),
('enable_password_reset', 'true', 'boolean', 'Enable password reset functionality', false, null),
('enable_account_lockout', 'true', 'boolean', 'Enable account lockout after failed attempts', false, null)
ON CONFLICT (setting_key) DO NOTHING; 