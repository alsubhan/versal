# Initial Database Setup

This directory contains comprehensive database schema dumps and setup scripts generated from the live Supabase database.

## 📁 Generated Files

### Schema Dumps
- **`complete_schema_dump_YYYYMMDD_HHMMSS.json`** - Complete database schema in JSON format with detailed column information and sample data
- **`complete_schema_dump_YYYYMMDD_HHMMSS.sql`** - Database schema overview in SQL format
- **`comprehensive_schema_dump_YYYYMMDD_HHMMSS.json`** - Comprehensive schema including all database objects (triggers, functions, indexes, etc.)
- **`comprehensive_schema_summary_YYYYMMDD_HHMMSS.sql`** - Complete summary of all database objects found
- **`live_schema_dump_YYYYMMDD_HHMMSS.json`** - Live database schema extracted directly from Supabase
- **`live_schema_summary_YYYYMMDD_HHMMSS.sql`** - Summary of live database objects

### Setup Scripts
- **`000_initial_database_setup_YYYYMMDD_HHMMSS.sql`** - Complete initial database setup script with all table definitions
- **`fresh_database_setup_YYYYMMDD_HHMMSS.sql`** - **FRESH COMPLETE SCRIPT** - All migrations combined into one comprehensive setup script

### Utility Scripts
- **`generate_schema.py`** - Simple script to test database connection and discover tables
- **`generate_complete_schema.py`** - Enhanced script to generate complete schema dumps with database objects
- **`extract_complete_schema.py`** - Comprehensive script that analyzes migrations, scripts, and live database
- **`extract_live_schema.py`** - Extract schema directly from live Supabase database
- **`extract_via_cli_YYYYMMDD_HHMMSS.sh`** - Shell script for Supabase CLI-based extraction

## 🗄️ Database Schema Overview

The database contains **19 tables** and **extensive database objects** organized into the following categories:

### Complete Database Objects Inventory
Based on comprehensive analysis of migrations, scripts, and live database:

- **Tables**: 19 live tables
- **Triggers**: 37 triggers (34 from migrations + 3 from scripts)
- **Functions**: 3 database functions
- **Indexes**: 40 performance indexes
- **Enums**: 1 custom enum type
- **Extensions**: 1 PostgreSQL extension
- **Constraints**: 6 database constraints
- **Views**: 0 views
- **Schema Updates**: 14 development scripts

### User Management
- `profiles` - User profiles and authentication
- `roles` - User roles and permissions

### Business Entities
- `customers` - Customer information and billing
- `suppliers` - Supplier information and contacts
- `products` - Product catalog and inventory
- `categories` - Product categorization
- `units` - Units of measurement

### Sales & Orders
- `sales_orders` - Sales order management
- `sales_order_items` - Individual items in sales orders
- `sale_invoices` - Sales invoice management
- `sale_invoice_items` - Individual items in sales invoices

### Purchasing
- `purchase_orders` - Purchase order management
- `purchase_order_items` - Individual items in purchase orders
- `good_receive_notes` - Goods received notes
- `good_receive_note_items` - Individual items in GRNs

### Financial
- `credit_notes` - Credit note management
- `credit_note_items` - Individual items in credit notes

### Inventory & System
- `inventory_transactions` - Inventory movement tracking
- `system_settings` - System configuration

## 🔧 Usage

### 1. Generate New Schema Dump
```bash
cd supabase/scripts/initial-database-setup
source ../../../backend/venv/bin/activate
python generate_complete_schema.py
```

### 2. Use Initial Setup Script
The `000_initial_database_setup_*.sql` file can be used to:
- Set up a new database from scratch
- Verify table structures
- Create development environments
- Document current schema state

### 3. Analyze Schema Changes
Compare different schema dumps to track:
- New tables added
- Column modifications
- Data type changes
- Sample data evolution

## 📊 Schema Information

### Key Features
- **UUID Primary Keys**: All tables use UUID primary keys
- **Timestamps**: Standard `created_at` and `updated_at` fields
- **Soft Deletes**: `is_active` boolean flags for soft deletion
- **Audit Trail**: Comprehensive audit fields throughout

### Data Types
- **Text Fields**: Names, descriptions, addresses
- **Numeric Fields**: Prices, quantities, limits
- **Boolean Fields**: Status flags, active states
- **Timestamp Fields**: Created/updated timestamps
- **JSON Fields**: Complex data structures (permissions, settings)

### Relationships
- **Foreign Keys**: Proper referential integrity
- **Cascade Deletes**: Appropriate cascade rules
- **Indexes**: Performance optimization indexes

## 🚀 Deployment

### Development Setup
1. Run the initial setup script to create tables
2. Apply existing migrations for additional features
3. Use data fix scripts to populate initial data

### Production Migration
1. Review schema changes in the dump
2. Create proper migrations for changes
3. Test in staging environment
4. Deploy with rollback plan

## 📈 Monitoring

### Schema Evolution
- Track schema changes over time
- Monitor table growth and performance
- Document breaking changes

### Data Quality
- Validate sample data integrity
- Check for data type consistency
- Monitor foreign key relationships

## 🔍 Troubleshooting

### Connection Issues
- Verify environment variables
- Check Supabase project access
- Ensure virtual environment is activated

### Schema Issues
- Compare with existing migrations
- Check for missing tables
- Validate column data types

### Data Issues
- Review sample data quality
- Check for null value handling
- Verify constraint compliance

## 📝 Best Practices

### Schema Management
- Generate dumps regularly
- Version control schema changes
- Document breaking changes
- Test migrations thoroughly

### Data Management
- Backup before major changes
- Use transactions for data modifications
- Validate data integrity
- Monitor performance impact

### Development Workflow
- Use schema dumps for documentation
- Compare changes between environments
- Test with realistic data
- Maintain backward compatibility

## 🔗 Related Resources

- [Supabase Documentation](../docs/)
- [Migration Scripts](../migrations/)
- [Development Scripts](../data-fixes/)
- [Verification Scripts](../verification/)

This initial database setup provides a solid foundation for understanding and managing the Versal database schema. 