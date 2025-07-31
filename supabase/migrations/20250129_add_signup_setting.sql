-- Add enable_signup system setting
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
VALUES (
  'enable_signup',
  'true',
  'boolean',
  'Enable user signup functionality',
  true,
  NOW(),
  NOW()
) ON CONFLICT (setting_key) DO NOTHING; 