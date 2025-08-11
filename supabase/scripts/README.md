# Supabase Scripts Organization

This directory contains organized SQL scripts that are not part of the official Supabase migration system but are essential for database maintenance and development.

> 📚 **Related Documentation**: See [../docs/](../docs/) for schema enhancement documentation and guides.

## Directory Structure

```
supabase/scripts/
├── data-fixes/           # Data correction and population scripts
├── schema-updates/       # Schema modification scripts
├── triggers/            # Database trigger scripts
├── verification/        # Data verification and testing scripts
├── initial-database-setup/ # Complete database schema dumps and setup scripts
└── README.md           # This file
```

## Script Categories

### 1. Data Fixes (`data-fixes/`)
Scripts for correcting existing data or populating missing data:

- `update_grn_totals.sql` - Updates GRN totals based on items
- `run_mock_data_migrations.sql` - Populates test data
- `insert_sale_invoices_only.sql` - Inserts sale invoice data
- `corrected_sale_invoices_migration.sql` - Corrects sale invoice data
- `add_rounding_adjustment_to_grn_and_sale_invoices.sql` - Adds rounding adjustments
- `fix_product_tax_rates.sql` - Fixes product tax rate data
- `fix_purchase_order_status.sql` - Fixes purchase order status data

### 2. Schema Updates (`schema-updates/`)
Scripts for modifying database schema:

- `add_missing_grn_columns.sql` - Adds missing columns to GRN tables
- `enhance_grn_items_schema.sql` - Enhances GRN items schema
- `enhance_credit_notes_schema.sql` - Enhances credit notes schema
- `enhance_sale_invoice_items_schema.sql` - Enhances sale invoice items schema
- `add_rounding_adjustment_column.sql` - Adds rounding adjustment columns
- `fix_stock_levels_schema.sql` - Fixes stock levels schema
- `add_is_direct_columns.sql` - Adds is_direct columns for creation mode tracking
- `add_missing_status_columns.sql` - Adds missing status columns
- `add_sales_order_id_and_is_direct_columns.sql` - Adds sales order reference and direct flags
- `standardize_all_status_columns_to_enums.sql` - Converts status columns to ENUM types
- `standardize_all_status_columns_to_enums_safe.sql` - Safe version of status standardization
- `standardize_status_columns.sql` - Standardizes status column formats
- `fix_enum_conflicts.sql` - Resolves ENUM type conflicts
- `fix_sales_order_status_enum.sql` - Fixes sales order status ENUM issues

### 3. Triggers (`triggers/`)
Database trigger scripts:

- `fix_purchase_order_trigger.sql` - Fixes purchase order triggers
- `fix_triggers.sql` - General trigger fixes
- `fix_trigger_conflict.sql` - Resolves trigger conflicts

### 4. Verification (`verification/`)
Scripts for verifying data integrity and testing:

- `check_sale_invoices_data.sql` - Verifies sale invoice data
- `check_sale_invoice_items_schema.sql` - Checks sale invoice items schema
- `verify_mock_data.sql` - Verifies mock data integrity
- `verify_table_structure.sql` - Verifies table structure and status columns
- `simple_verify_tables.sql` - Simple table verification script

### 5. Initial Database Setup (`initial-database-setup/`)
Complete database schema dumps and setup scripts:

- `generate_schema.py` - Simple database connection test
- `generate_complete_schema.py` - Comprehensive schema generation
- `complete_schema_dump_*.json` - Complete schema in JSON format
- `complete_schema_dump_*.sql` - Schema overview in SQL format
- `000_initial_database_setup_*.sql` - Complete setup script

## Usage Guidelines

### When to Use These Scripts

1. **Development Environment**: Use these scripts for setting up development databases
2. **Data Migration**: Apply data fixes when migrating between environments
3. **Emergency Fixes**: Use for hotfixes that need immediate application
4. **Testing**: Use verification scripts to ensure data integrity

### Execution Order

1. **Schema Updates** (if needed)
2. **Data Fixes** (to populate/correct data)
3. **Triggers** (to ensure proper functionality)
4. **Verification** (to confirm everything works)

### Best Practices

1. **Always backup** before running scripts
2. **Test in development** first
3. **Document changes** in commit messages
4. **Use transactions** for data modification scripts
5. **Verify results** after execution

### Converting to Official Migrations

When a script becomes part of the core application:

1. Create a new migration in `supabase/migrations/`
2. Use proper timestamp naming: `YYYYMMDDHHMMSS_description.sql`
3. Remove the script from this directory
4. Update this README

## Migration vs Scripts

### Official Migrations (`supabase/migrations/`)
- Applied automatically by Supabase
- Version controlled and tracked
- Part of the application's core schema
- Run in order by timestamp

### Scripts (`supabase/scripts/`)
- Manual execution required
- Development and maintenance tools
- One-time fixes and data corrections
- Organized by purpose, not execution order

## Emergency Procedures

For production issues requiring immediate fixes:

1. **Create backup** of affected data
2. **Identify appropriate script** from this directory
3. **Test in staging** if possible
4. **Execute script** with proper monitoring
5. **Verify results** using verification scripts
6. **Create official migration** for future deployments

## Contributing

When adding new scripts:

1. **Choose appropriate category** based on script purpose
2. **Use descriptive names** that explain the script's function
3. **Add comments** explaining what the script does
4. **Update this README** with script description
5. **Test thoroughly** before committing 