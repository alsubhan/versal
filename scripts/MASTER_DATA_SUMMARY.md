# Master Data & Settings Summary

This document lists all master/reference tables and settings that have INSERT statements in the migrations.

## Master/Reference Tables with Seed Data

### 1. **system_settings** (Settings/Configuration Table)
**Files:**
- `20250129_insert_system_settings.sql` - Main system settings (17 entries)
- `20250129_add_missing_system_settings.sql` - Additional settings (27 entries)
- `20250129_add_invoice_settings.sql` - Invoice-related settings (7 entries)
- `20250129_add_signup_setting.sql` - Signup setting (1 entry)

**Total Settings Categories:**
- Company information (name, address, phone, email, city, state, zip, country)
- Currency and tax settings
- Invoice/PO/GRN prefixes and numbering
- Stock management settings
- Security settings (passwords, login attempts, lockout)
- System preferences (date format, timezone, language)
- Feature toggles (signup, email verification, 2FA, etc.)
- File upload settings
- Audit and backup settings

### 2. **roles** (User Roles)
**File:** `seed_roles.sql`
- Administrator (full permissions)
- Manager (limited permissions)
- Staff (basic permissions)

### 3. **categories** (Product Categories)
**File:** `20250129_insert_test_products.sql`
- Electronics
- Clothing
- Home & Garden

### 4. **units** (Measurement Units)
**File:** `20250129_insert_test_products.sql`
- Piece (pc)
- Kilogram (kg)
- Liter (L)

### 5. **locations** (Warehouse Locations)
**File:** `20250129_create_inventory_tables.sql`
- Main Warehouse
- Store Front
- Secondary Storage

### 6. **suppliers** (Supplier Master Data)
**File:** `20250129_insert_mock_data.sql`
- 5 sample suppliers (Tech Solutions Inc., Global Manufacturing Co., etc.)

### 7. **customers** (Customer Master Data)
**File:** `20250129_insert_mock_data.sql`
- 5 sample customers (Retail Store ABC, Wholesale Distributor XYZ, etc.)

### 8. **products** (Product Master Data)
**File:** `20250129_insert_test_products.sql`
- 3 test products (Premium Wireless Headphones, Cotton T-Shirt, Garden Hose)

### 9. **stock_levels** (Initial Stock Data)
**File:** `20250129_insert_test_products.sql`
- Stock levels for the 3 test products

### 10. **taxes** (Tax Master Data)
**File:** `20250726071655-fdbd07be-c0d9-480d-958f-241f8fe844be.sql`
- Standard Tax (15% - default, applied to both)
- Reduced Tax (7.5% - for essential items)
- Zero Tax (0% - tax-free items)

### 11. **profiles** (User Profiles)
**Note:** Created automatically via trigger `on_auth_user_created` when users sign up
**File:** `20250726071655-fdbd07be-c0d9-480d-958f-241f8fe844be.sql` (trigger definition)
- No explicit seed data - profiles are created automatically when users are created in auth.users
- The trigger function `handle_new_user()` creates a profile entry for each new user

### 12. **user_settings** (User Preferences)
**Note:** Created automatically via trigger `on_profile_created` when a profile is created
**File:** `20250726072529-533169c1-8f6a-4b2a-aaa8-8950a7a56b9b.sql` (trigger definition)
- No explicit seed data - user settings are created automatically when profiles are created
- The trigger function `create_default_user_settings()` creates default user settings for each new profile
- Default settings include: theme, language, timezone, date format, currency, notification preferences, etc.

## Transactional Data (Mock Data - Optional)

These are NOT master data but included for testing:

- **purchase_orders** - `20250130_insert_purchase_orders_mock_data.sql`
- **purchase_order_items** - `20250130_insert_purchase_orders_mock_data.sql`
- **good_receive_notes** - `20250130_insert_grn_mock_data.sql`
- **good_receive_note_items** - `20250130_insert_grn_mock_data.sql`
- **sales_orders** - `20250130_insert_sales_orders_mock_data.sql`
- **sales_order_items** - `20250130_insert_sales_orders_mock_data.sql`
- **sale_invoices** - `20250130_insert_sale_invoices_mock_data.sql`
- **sale_invoice_items** - `20250130_insert_sale_invoices_mock_data.sql`
- **credit_notes** - `20250129_insert_credit_notes_data.sql` & `20250130_insert_credit_notes_mock_data.sql`
- **credit_note_items** - `20250129_insert_credit_note_items.sql`

## Critical Master Data (Must Have)

The following tables MUST have data for the system to function:

1. **system_settings** - System configuration
2. **roles** - User roles and permissions
3. **locations** - Warehouse locations (for inventory)
4. **categories** - Product categories (for products)
5. **units** - Measurement units (for products)
6. **taxes** - Tax rates (for calculations)
7. **profiles** - User profiles (created automatically via trigger)
8. **user_settings** - User preferences (created automatically via trigger)

## Important Notes

- `supabase db pull` only pulls **schema changes** (CREATE TABLE, ALTER TABLE, etc.)
- It does **NOT** pull data (INSERT statements)
- Master data must be inserted via migration files or data dump
- Settings data is critical for system initialization

