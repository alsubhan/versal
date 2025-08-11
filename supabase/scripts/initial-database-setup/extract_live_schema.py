#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract complete database schema directly from live Supabase database
"""

import os
import sys
from supabase import create_client
from datetime import datetime
import json

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
        print(f"Loaded environment from: {env_file}")
    else:
        print(f"Environment file not found: {env_file}")

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

def get_live_tables(supabase):
    """Get all tables from live database"""
    print("Extracting tables from live database...")
    
    tables = [
        'profiles', 'roles', 'customers', 'suppliers', 'products', 'categories',
        'units', 'tax_rates', 'sales_orders', 'sales_order_items', 'sale_invoices',
        'sale_invoice_items', 'purchase_orders', 'purchase_order_items',
        'good_receive_notes', 'good_receive_note_items', 'credit_notes',
        'credit_note_items', 'inventory_transactions', 'system_settings'
    ]
    
    live_tables = {}
    existing_tables = []
    
    for table in tables:
        try:
            result = supabase.table(table).select("*").limit(1).execute()
            existing_tables.append(table)
            
            if result.data:
                columns = {}
                for key, value in result.data[0].items():
                    columns[key] = {
                        "type": type(value).__name__,
                        "sample_value": str(value)[:100] if value is not None else None
                    }
                live_tables[table] = {
                    "exists": True,
                    "columns": columns,
                    "sample_data": result.data[0]
                }
            else:
                live_tables[table] = {
                    "exists": True,
                    "columns": {},
                    "note": "Table exists but is empty"
                }
            print(f"  Found: {table}")
                
        except Exception as e:
            live_tables[table] = {
                "exists": False,
                "error": str(e)
            }
    
    return live_tables, existing_tables

def get_database_objects_via_api(supabase):
    """Get database objects using available API methods"""
    objects_info = {
        "triggers": [],
        "functions": [],
        "indexes": [],
        "constraints": [],
        "enums": [],
        "extensions": [],
        "views": []
    }
    
    # Try to get information using available methods
    print("Extracting database objects...")
    
    # For now, we'll note what we can extract via API
    # and suggest using Supabase CLI for complete extraction
    objects_info["note"] = "Complete object extraction requires Supabase CLI or direct PostgreSQL access"
    
    return objects_info

def create_live_schema_dump(supabase):
    """Create schema dump from live database"""
    print("Creating live schema dump...")
    
    # Get live table information
    live_tables, existing_tables = get_live_tables(supabase)
    
    # Get database objects (limited via API)
    db_objects = get_database_objects_via_api(supabase)
    
    schema_info = {
        "generated_at": datetime.now().isoformat(),
        "project_id": "bmyaefeddtcbnmpzvxmf",
        "source": "Live Supabase Database (API Access)",
        "tables": live_tables,
        "database_objects": db_objects,
        "summary": {
            "total_tables": len(existing_tables),
            "note": "Complete object extraction requires Supabase CLI"
        }
    }
    
    return schema_info

def save_live_dump(schema_info):
    """Save live schema dump"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save JSON
    json_filename = f"live_schema_dump_{timestamp}.json"
    with open(json_filename, 'w') as f:
        json.dump(schema_info, f, indent=2)
    
    # Save SQL summary
    sql_filename = f"live_schema_summary_{timestamp}.sql"
    with open(sql_filename, 'w') as f:
        f.write("-- Live Database Schema Summary\n")
        f.write(f"-- Generated at: {schema_info['generated_at']}\n")
        f.write(f"-- Project ID: {schema_info['project_id']}\n")
        f.write(f"-- Source: {schema_info['source']}\n\n")
        
        f.write("-- Tables Found:\n")
        for table_name, table_info in schema_info['tables'].items():
            if table_info.get('exists'):
                f.write(f"--   {table_name}\n")
                if table_info.get('columns'):
                    f.write(f"--     Columns: {len(table_info['columns'])}\n")
        f.write("\n")
        
        f.write("-- Note: Complete object extraction requires:\n")
        f.write("-- 1. Supabase CLI: supabase db pull\n")
        f.write("-- 2. Direct PostgreSQL connection\n")
        f.write("-- 3. Database admin privileges\n")
    
    print(f"Live schema dump saved to: {json_filename}")
    print(f"Live schema summary saved to: {sql_filename}")
    
    return json_filename, sql_filename

def create_cli_extraction_script():
    """Create script for Supabase CLI extraction"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"extract_via_cli_{timestamp}.sh"
    
    with open(filename, 'w') as f:
        f.write("#!/bin/bash\n")
        f.write("# Extract Complete Database Schema via Supabase CLI\n")
        f.write(f"# Generated at: {datetime.now().isoformat()}\n\n")
        
        f.write("echo 'Extracting complete database schema via Supabase CLI...'\n\n")
        
        f.write("# Check if Supabase CLI is installed\n")
        f.write("if ! command -v supabase &> /dev/null; then\n")
        f.write("    echo 'Error: Supabase CLI is not installed'\n")
        f.write("    echo 'Install from: https://supabase.com/docs/guides/cli'\n")
        f.write("    exit 1\n")
        f.write("fi\n\n")
        
        f.write("# Check if logged in\n")
        f.write("if ! supabase projects list &> /dev/null; then\n")
        f.write("    echo 'Please login to Supabase CLI first: supabase login'\n")
        f.write("    exit 1\n")
        f.write("fi\n\n")
        
        f.write("# Extract complete schema\n")
        f.write("echo 'Pulling complete database schema...'\n")
        f.write("supabase db pull --schema public\n\n")
        
        f.write("# Generate TypeScript types\n")
        f.write("echo 'Generating TypeScript types...'\n")
        f.write("supabase gen types typescript --local > types.ts\n\n")
        
        f.write("# Create complete dump\n")
        f.write("echo 'Creating complete schema dump...'\n")
        f.write("pg_dump $DATABASE_URL --schema=public --no-owner --no-privileges > complete_schema_dump.sql\n\n")
        
        f.write("echo 'Complete extraction finished!'\n")
        f.write("echo 'Files generated:'\n")
        f.write("echo '  - supabase/migrations/ (latest migration with all objects)'\n")
        f.write("echo '  - types.ts (TypeScript types)'\n")
        f.write("echo '  - complete_schema_dump.sql (complete PostgreSQL dump)'\n")
    
    os.chmod(filename, 0o755)
    print(f"CLI extraction script saved to: {filename}")
    return filename

def main():
    print("Extracting schema from live Supabase database...")
    
    load_env()
    supabase = connect_supabase()
    
    if not supabase:
        return
    
    # Create live schema dump
    schema_info = create_live_schema_dump(supabase)
    
    if schema_info:
        # Save dumps
        json_file, sql_file = save_live_dump(schema_info)
        cli_script = create_cli_extraction_script()
        
        print(f"\nLive schema extraction completed!")
        print(f"Files created:")
        print(f"  - JSON dump: {json_file}")
        print(f"  - SQL summary: {sql_file}")
        print(f"  - CLI extraction script: {cli_script}")
        
        print(f"\nLive Database Summary:")
        print(f"  Tables: {schema_info['summary']['total_tables']}")
        
        print(f"\nNote: For complete object extraction (triggers, functions, etc.):")
        print(f"  1. Run the CLI script: {cli_script}")
        print(f"  2. Or use: supabase db pull")
        print(f"  3. Or connect directly to PostgreSQL")
    else:
        print("Failed to extract live schema")

if __name__ == "__main__":
    main() 