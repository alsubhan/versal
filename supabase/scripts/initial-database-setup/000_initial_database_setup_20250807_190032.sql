-- Initial Database Setup Script
-- Generated at: 2025-08-07T19:00:25.485818
-- Project ID: bmyaefeddtcbnmpzvxmf
-- This script sets up the complete database schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT,
    username TEXT,
    full_name TEXT,
    is_active BOOLEAN,
    created_at TEXT,
    updated_at TEXT,
    role_id TEXT
);

-- Create table: roles
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT,
    name TEXT,
    description TEXT,
    permissions TEXT,
    created_at TEXT,
    updated_at TEXT
);

-- Create table: customers
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    shipping_address TEXT,
    tax_id TEXT,
    notes TEXT,
    credit_limit NUMERIC,
    current_credit NUMERIC,
    customer_type TEXT,
    created_at TEXT,
    updated_at TEXT,
    is_active BOOLEAN
);

-- Create table: suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT,
    name TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    payment_terms TEXT,
    tax_id TEXT,
    notes TEXT,
    is_active BOOLEAN,
    created_at TEXT,
    updated_at TEXT,
    billing_address TEXT,
    shipping_address TEXT
);

-- Create table: products
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT,
    name TEXT,
    description TEXT,
    sku_code TEXT,
    barcode TEXT,
    category_id TEXT,
    unit_id TEXT,
    cost_price NUMERIC,
    selling_price NUMERIC,
    minimum_stock INTEGER,
    maximum_stock TEXT,
    reorder_point INTEGER,
    is_active BOOLEAN,
    created_at TEXT,
    updated_at TEXT,
    hsn_code TEXT,
    manufacturer_part_number TEXT,
    supplier_id TEXT,
    sale_tax_id TEXT,
    purchase_tax_id TEXT,
    manufacturer TEXT,
    brand TEXT,
    warranty_period INTEGER,
    warranty_unit TEXT,
    product_tags TEXT,
    is_serialized BOOLEAN,
    track_inventory BOOLEAN,
    allow_override_price BOOLEAN,
    discount_percentage NUMERIC,
    warehouse_rack TEXT,
    unit_conversions TEXT,
    mrp NUMERIC,
    sale_price NUMERIC,
    subcategory_id TEXT,
    sale_tax_type TEXT,
    purchase_tax_type TEXT,
    initial_quantity INTEGER
);

-- Create table: categories
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT,
    name TEXT,
    description TEXT,
    parent_id TEXT,
    is_active BOOLEAN,
    created_at TEXT,
    updated_at TEXT
);

-- Create table: units
CREATE TABLE IF NOT EXISTS public.units (
    id TEXT,
    name TEXT,
    abbreviation TEXT,
    description TEXT,
    created_at TEXT,
    updated_at TEXT,
    is_active BOOLEAN
);

-- Create table: sales_orders
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id TEXT,
    order_number TEXT,
    customer_id TEXT,
    order_date TEXT,
    due_date TEXT,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    discount_amount NUMERIC,
    total_amount NUMERIC,
    notes TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    rounding_adjustment NUMERIC,
    status TEXT
);

-- Create table: sales_order_items
CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id TEXT,
    sales_order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    unit_price NUMERIC,
    discount NUMERIC,
    tax NUMERIC,
    total NUMERIC,
    created_at TEXT,
    updated_at TEXT,
    product_name TEXT,
    sku_code TEXT,
    hsn_code TEXT,
    sale_tax_type TEXT,
    unit_abbreviation TEXT,
    created_by TEXT
);

-- Create table: sale_invoices
CREATE TABLE IF NOT EXISTS public.sale_invoices (
    id TEXT,
    invoice_number TEXT,
    customer_id TEXT,
    invoice_date TEXT,
    due_date TEXT,
    payment_method TEXT,
    payment_reference TEXT,
    payment_date TEXT,
    credit_note_id TEXT,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    discount_amount NUMERIC,
    total_amount NUMERIC,
    amount_paid NUMERIC,
    amount_due NUMERIC,
    notes TEXT,
    affects_inventory BOOLEAN,
    inventory_processed BOOLEAN,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    rounding_adjustment NUMERIC,
    sales_order_id TEXT,
    is_direct BOOLEAN,
    status TEXT
);

-- Create table: sale_invoice_items
CREATE TABLE IF NOT EXISTS public.sale_invoice_items (
    id TEXT,
    invoice_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    unit_price NUMERIC,
    discount NUMERIC,
    tax NUMERIC,
    total NUMERIC,
    created_at TEXT,
    updated_at TEXT,
    sales_order_item_id TEXT,
    product_name TEXT,
    sku_code TEXT,
    hsn_code TEXT,
    sale_tax_type TEXT,
    unit_abbreviation TEXT,
    created_by TEXT
);

-- Create table: purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id TEXT,
    order_number TEXT,
    supplier_id TEXT,
    order_date TEXT,
    expected_delivery_date TEXT,
    status TEXT,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    discount_amount NUMERIC,
    total_amount NUMERIC,
    notes TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    rounding_adjustment NUMERIC
);

-- Create table: purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id TEXT,
    purchase_order_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    cost_price NUMERIC,
    discount NUMERIC,
    tax NUMERIC,
    total NUMERIC,
    created_at TEXT,
    updated_at TEXT,
    product_name TEXT,
    sku_code TEXT,
    hsn_code TEXT,
    purchase_tax_type TEXT,
    unit_abbreviation TEXT,
    created_by TEXT
);

-- Create table: good_receive_notes
CREATE TABLE IF NOT EXISTS public.good_receive_notes (
    id TEXT,
    grn_number TEXT,
    purchase_order_id TEXT,
    supplier_id TEXT,
    received_date TEXT,
    received_by TEXT,
    status TEXT,
    total_received_items INTEGER,
    notes TEXT,
    quality_check_status TEXT,
    warehouse_location TEXT,
    created_at TEXT,
    updated_at TEXT,
    rounding_adjustment NUMERIC,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    discount_amount NUMERIC,
    total_amount NUMERIC,
    is_direct BOOLEAN
);

-- Create table: good_receive_note_items
CREATE TABLE IF NOT EXISTS public.good_receive_note_items (
    id TEXT,
    grn_id TEXT,
    purchase_order_item_id TEXT,
    product_id TEXT,
    ordered_quantity INTEGER,
    received_quantity INTEGER,
    rejected_quantity INTEGER,
    accepted_quantity INTEGER,
    unit_cost NUMERIC,
    batch_number TEXT,
    expiry_date TEXT,
    manufacturing_date TEXT,
    quality_notes TEXT,
    storage_location TEXT,
    created_at TEXT,
    updated_at TEXT,
    product_name TEXT,
    sku_code TEXT,
    hsn_code TEXT,
    purchase_tax_type TEXT,
    unit_abbreviation TEXT,
    discount NUMERIC,
    tax NUMERIC,
    total NUMERIC,
    created_by TEXT
);

-- Create table: credit_notes
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id TEXT,
    credit_note_number TEXT,
    sales_order_id TEXT,
    customer_id TEXT,
    credit_date TEXT,
    reason TEXT,
    reason_description TEXT,
    status TEXT,
    approval_required BOOLEAN,
    approved_by TEXT,
    approved_date TEXT,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    discount_amount NUMERIC,
    total_amount NUMERIC,
    refund_method TEXT,
    refund_processed BOOLEAN,
    refund_date TEXT,
    refund_reference TEXT,
    affects_inventory BOOLEAN,
    inventory_processed BOOLEAN,
    notes TEXT,
    internal_notes TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    rounding_adjustment NUMERIC
);

-- Create table: credit_note_items
CREATE TABLE IF NOT EXISTS public.credit_note_items (
    id TEXT,
    credit_note_id TEXT,
    product_id TEXT,
    sales_order_item_id TEXT,
    original_quantity INTEGER,
    credit_quantity INTEGER,
    unit_price NUMERIC,
    discount NUMERIC,
    tax NUMERIC,
    total NUMERIC,
    returned_quantity INTEGER,
    condition_on_return TEXT,
    return_to_stock BOOLEAN,
    batch_number TEXT,
    expiry_date TEXT,
    storage_location TEXT,
    quality_notes TEXT,
    created_at TEXT,
    updated_at TEXT,
    product_name TEXT,
    sku_code TEXT,
    hsn_code TEXT,
    sale_tax_type TEXT,
    unit_abbreviation TEXT,
    created_by TEXT
);

-- Create table: inventory_transactions
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id TEXT,
    product_id TEXT,
    transaction_type TEXT,
    quantity_change INTEGER,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT
);

-- Create table: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT,
    setting_key TEXT,
    setting_value TEXT,
    setting_type TEXT,
    description TEXT,
    is_public BOOLEAN,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
);

