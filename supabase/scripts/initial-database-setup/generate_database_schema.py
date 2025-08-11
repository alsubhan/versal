#!/usr/bin/env python3
"""
Script to connect to Supabase database and generate a comprehensive schema dump
"""

import os
import sys
from supabase import create_client, Client
import json
from datetime import datetime

# Load environment variables from backend/.env
def load_env():
    """Load environment variables from backend/.env file"""
    env_file = "backend/.env"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

def connect_to_supabase():
    """Connect to Supabase using environment variables"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        sys.exit(1)
    
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✅ Successfully connected to Supabase")
        return supabase
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {str(e)}")
        sys.exit(1)

def get_table_schema(supabase, table_name):
    """Get schema information for a specific table"""
    try:
        # Get a sample record to understand the structure
        result = supabase.table(table_name).select("*").limit(1).execute()
        
        if result.data:
            # Get column information from the first record
            columns = {}
            for key, value in result.data[0].items():
                columns[key] = type(value).__name__
            return columns
        else:
            # Empty table, try to get schema from information_schema
            return {"note": "Table exists but is empty"}
    except Exception as e:
        return {"error": str(e)}

def get_all_tables(supabase):
    """Get list of all tables in the database"""
    try:
        # Query information_schema to get all tables
        query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        """
        
        # Since we can't run raw SQL directly, let's try to discover tables
        # by attempting to query common table names
        common_tables = [
            'profiles', 'roles', 'customers', 'suppliers', 'products', 'categories',
            'units', 'tax_rates', 'sales_orders', 'sales_order_items', 'sale_invoices',
            'sale_invoice_items', 'purchase_orders', 'purchase_order_items',
            'good_receive_notes', 'good_receive_note_items', 'credit_notes',
            'credit_note_items', 'inventory_transactions', 'system_settings'
        ]
        
        existing_tables = []
        for table in common_tables:
            try:
                result = supabase.table(table).select("*").limit(1).execute()
                existing_tables.append(table)
                print(f"✅ Found table: {table}")
            except Exception:
                # Table doesn't exist or we don't have access
                pass
        
        return existing_tables
    except Exception as e:
        print(f"❌ Error getting tables: {str(e)}")
        return []

def generate_schema_dump(supabase):
    """Generate a comprehensive schema dump"""
    print("\n🔍 Discovering database schema...")
    
    # Get all tables
    tables = get_all_tables(supabase)
    
    if not tables:
        print("❌ No tables found or unable to access database")
        return None
    
    print(f"\n📊 Found {len(tables)} tables")
    
    # Generate schema information
    schema_info = {
        "generated_at": datetime.now().isoformat(),
        "project_id": "bmyaefeddtcbnmpzvxmf",
        "tables": {}
    }
    
    for table in tables:
        print(f"\n📋 Analyzing table: {table}")
        schema_info["tables"][table] = get_table_schema(supabase, table)
    
    return schema_info

def save_schema_dump(schema_info):
    """Save schema dump to file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"supabase/scripts/initial-database-setup/schema_dump_{timestamp}.json"
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'w') as f:
        json.dump(schema_info, f, indent=2)
    
    print(f"\n💾 Schema dump saved to: {filename}")
    return filename

def create_sql_schema(schema_info):
    """Create SQL schema from the dump"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"supabase/scripts/initial-database-setup/initial_schema_{timestamp}.sql"
    
    with open(filename, 'w') as f:
        f.write("-- Initial Database Schema\n")
        f.write(f"-- Generated at: {schema_info['generated_at']}\n")
        f.write(f"-- Project ID: {schema_info['project_id']}\n")
        f.write("-- This file contains the current database schema\n\n")
        
        for table_name, table_info in schema_info['tables'].items():
            f.write(f"-- Table: {table_name}\n")
            if 'error' in table_info:
                f.write(f"-- Error: {table_info['error']}\n")
            elif 'note' in table_info:
                f.write(f"-- Note: {table_info['note']}\n")
            else:
                f.write("-- Columns:\n")
                for column, data_type in table_info.items():
                    f.write(f"--   {column}: {data_type}\n")
            f.write("\n")
    
    print(f"📝 SQL schema saved to: {filename}")
    return filename

def main():
    """Main function"""
    print("🚀 Starting Supabase Database Schema Generation...")
    
    # Load environment variables
    load_env()
    
    # Connect to Supabase
    supabase = connect_to_supabase()
    
    # Generate schema dump
    schema_info = generate_schema_dump(supabase)
    
    if schema_info:
        # Save JSON dump
        json_file = save_schema_dump(schema_info)
        
        # Create SQL schema
        sql_file = create_sql_schema(schema_info)
        
        print(f"\n✅ Schema generation completed!")
        print(f"📄 JSON dump: {json_file}")
        print(f"📄 SQL schema: {sql_file}")
        
        # Print summary
        print(f"\n📊 Summary:")
        print(f"   Tables found: {len(schema_info['tables'])}")
        print(f"   Tables: {', '.join(schema_info['tables'].keys())}")
    else:
        print("❌ Failed to generate schema dump")

if __name__ == "__main__":
    main() 