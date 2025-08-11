#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate database schema from Supabase
"""

import os
import sys
from supabase import create_client
from datetime import datetime

def load_env():
    """Load environment variables"""
    env_file = "../../../backend/.env"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

def connect_supabase():
    """Connect to Supabase"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Missing environment variables")
        return None
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("Connected to Supabase")
        return supabase
    except Exception as e:
        print(f"Connection failed: {e}")
        return None

def discover_tables(supabase):
    """Discover existing tables"""
    tables = [
        'profiles', 'roles', 'customers', 'suppliers', 'products', 'categories',
        'units', 'tax_rates', 'sales_orders', 'sales_order_items', 'sale_invoices',
        'sale_invoice_items', 'purchase_orders', 'purchase_order_items',
        'good_receive_notes', 'good_receive_note_items', 'credit_notes',
        'credit_note_items', 'inventory_transactions', 'system_settings'
    ]
    
    existing_tables = []
    for table in tables:
        try:
            result = supabase.table(table).select("*").limit(1).execute()
            existing_tables.append(table)
            print(f"Found: {table}")
        except:
            pass
    
    return existing_tables

def main():
    print("Connecting to Supabase...")
    
    load_env()
    supabase = connect_supabase()
    
    if not supabase:
        return
    
    print("\nDiscovering tables...")
    tables = discover_tables(supabase)
    
    print(f"\nFound {len(tables)} tables: {', '.join(tables)}")

if __name__ == "__main__":
    main() 