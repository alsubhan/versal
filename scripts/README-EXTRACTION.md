# Supabase Data Extraction Guide

## ✅ Installation Complete!

Supabase CLI has been installed to: `~/.local/bin/supabase`

## Next Steps

### 1. Add Supabase CLI to your PATH (if not already done)

Add this line to your `~/.zshrc` or `~/.bash_profile`:
```bash
export PATH="${HOME}/.local/bin:${PATH}"
```

Then reload your shell:
```bash
source ~/.zshrc
# or
source ~/.bash_profile
```

### 2. Login to Supabase CLI

Run this command and follow the prompts:
```bash
supabase login
```

This will:
- Open your browser for authentication
- Ask you to authorize the CLI
- Save your access token

### 3. Run the Extraction Script

Once logged in, run:
```bash
./scripts/extract-supabase-data.sh
```

This will:
- Connect to your Supabase project (bmyaefeddtcbnmpzvxmf)
- Extract complete database schema
- Extract master data from reference tables
- Create `supabase/init.sql` file

### 4. Deploy Local Supabase

After extraction, deploy Supabase locally:
```bash
./scripts/deploy-local.sh --target supabase
```

The deployment script will automatically:
- Deploy Supabase containers
- Run `supabase/init.sql` to initialize the database (only on first run)

## Troubleshooting

### If `supabase` command not found:
```bash
export PATH="${HOME}/.local/bin:${PATH}"
```

### If login fails:
- Make sure you have access to the Supabase project
- Try: `supabase login --debug`

### If extraction fails:
- Check that you're logged in: `supabase projects list`
- Verify project ID in `supabase/config.toml`
- Check network connection

## Files Created

- `supabase/init.sql` - Complete database initialization file (schema + master data)
- `supabase/init.sql.backup.*` - Backup of previous init.sql (if it existed)

