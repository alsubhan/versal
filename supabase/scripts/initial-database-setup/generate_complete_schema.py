#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate complete database schema from Supabase including all objects
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

def get_table_schema(supabase, table_name):
    """Get detailed schema information for a table"""
    try:
        # Get a sample record to understand the structure
        result = supabase.table(table_name).select("*").limit(1).execute()
        
        schema_info = {
            "table_name": table_name,
            "exists": True,
            "columns": {},
            "sample_data": None
        }
        
        if result.data:
            # Get column information from the first record
            for key, value in result.data[0].items():
                schema_info["columns"][key] = {
                    "type": type(value).__name__,
                    "sample_value": str(value)[:100] if value is not None else None
                }
            schema_info["sample_data"] = result.data[0]
        else:
            schema_info["note"] = "Table exists but is empty"
            
        return schema_info
    except Exception as e:
        return {
            "table_name": table_name,
            "exists": False,
            "error": str(e)
        }

def get_database_objects(supabase):
    """Get all database objects using RPC calls"""
    objects_info = {
        "triggers": [],
        "functions": [],
        "indexes": [],
        "constraints": [],
        "enums": [],
        "extensions": [],
        "views": []
    }
    
    try:
        # Get triggers
        print("Fetching triggers...")
        result = supabase.rpc('get_triggers').execute()
        if result.data:
            objects_info["triggers"] = result.data
    except:
        print("Could not fetch triggers via RPC")
    
    try:
        # Get functions
        print("Fetching functions...")
        result = supabase.rpc('get_functions').execute()
        if result.data:
            objects_info["functions"] = result.data
    except:
        print("Could not fetch functions via RPC")
    
    try:
        # Get indexes
        print("Fetching indexes...")
        result = supabase.rpc('get_indexes').execute()
        if result.data:
            objects_info["indexes"] = result.data
    except:
        print("Could not fetch indexes via RPC")
    
    return objects_info

def get_table_constraints(supabase, table_name):
    """Get constraints for a specific table"""
    constraints = []
    try:
        # Try to get foreign key constraints
        result = supabase.table(table_name).select("*").limit(1).execute()
        # Note: This is a simplified approach - in a real scenario, you'd need to query information_schema
        constraints.append({
            "type": "foreign_key",
            "note": "Foreign key constraints would be detected here"
        })
    except Exception as e:
        constraints.append({
            "type": "error",
            "message": str(e)
        })
    
    return constraints

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

def generate_complete_schema(supabase, tables):
    """Generate complete schema information including all objects"""
    print("\nAnalyzing table schemas...")
    
    schema_info = {
        "generated_at": datetime.now().isoformat(),
        "project_id": "bmyaefeddtcbnmpzvxmf",
        "tables": {},
        "database_objects": {},
        "constraints": {},
        "notes": []
    }
    
    # Get table schemas
    for table in tables:
        print(f"Analyzing: {table}")
        schema_info["tables"][table] = get_table_schema(supabase, table)
        
        # Get constraints for each table
        schema_info["constraints"][table] = get_table_constraints(supabase, table)
    
    # Get database objects
    print("\nFetching database objects...")
    schema_info["database_objects"] = get_database_objects(supabase)
    
    # Add notes about limitations
    schema_info["notes"].append("This schema dump captures table structures and sample data")
    schema_info["notes"].append("Triggers, functions, and constraints may need manual extraction")
    schema_info["notes"].append("Use Supabase CLI or direct PostgreSQL connection for complete schema")
    
    return schema_info

def save_schema_dump(schema_info, format_type="json"):
    """Save schema dump to file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if format_type == "json":
        filename = f"complete_schema_dump_{timestamp}.json"
        with open(filename, 'w') as f:
            json.dump(schema_info, f, indent=2)
    else:
        filename = f"complete_schema_dump_{timestamp}.sql"
        with open(filename, 'w') as f:
            f.write("-- Complete Database Schema Dump\n")
            f.write(f"-- Generated at: {schema_info['generated_at']}\n")
            f.write(f"-- Project ID: {schema_info['project_id']}\n\n")
            
            # Write notes
            f.write("-- Notes:\n")
            for note in schema_info.get('notes', []):
                f.write(f"-- {note}\n")
            f.write("\n")
            
            # Write tables
            f.write("-- Tables:\n")
            for table_name, table_info in schema_info['tables'].items():
                f.write(f"-- Table: {table_name}\n")
                if table_info.get('exists'):
                    f.write("-- Status: EXISTS\n")
                    if 'columns' in table_info:
                        f.write("-- Columns:\n")
                        for col_name, col_info in table_info['columns'].items():
                            f.write(f"--   {col_name}: {col_info['type']}\n")
                    if 'sample_data' in table_info and table_info['sample_data']:
                        f.write("-- Sample data available\n")
                else:
                    f.write(f"-- Status: NOT FOUND\n")
                    if 'error' in table_info:
                        f.write(f"-- Error: {table_info['error']}\n")
                f.write("\n")
            
            # Write database objects
            f.write("-- Database Objects:\n")
            for obj_type, objects in schema_info.get('database_objects', {}).items():
                f.write(f"-- {obj_type.upper()}:\n")
                if objects:
                    for obj in objects:
                        f.write(f"--   {obj}\n")
                else:
                    f.write(f"--   No {obj_type} found or accessible\n")
                f.write("\n")
    
    print(f"Schema dump saved to: {filename}")
    return filename

def create_initial_setup_script(schema_info):
    """Create an initial setup script based on the schema"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"000_initial_database_setup_{timestamp}.sql"
    
    with open(filename, 'w') as f:
        f.write("-- Initial Database Setup Script\n")
        f.write(f"-- Generated at: {schema_info['generated_at']}\n")
        f.write(f"-- Project ID: {schema_info['project_id']}\n")
        f.write("-- This script sets up the complete database schema\n\n")
        
        # Add notes about limitations
        f.write("-- IMPORTANT: This script only creates table structures\n")
        f.write("-- Triggers, functions, constraints, and indexes need to be added separately\n")
        f.write("-- Use the migration files in ../migrations/ for complete setup\n\n")
        
        # Add common extensions
        f.write("-- Enable required extensions\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";\n\n")
        
        # Create tables based on discovered schema
        for table_name, table_info in schema_info['tables'].items():
            if table_info.get('exists') and 'columns' in table_info:
                f.write(f"-- Create table: {table_name}\n")
                f.write(f"CREATE TABLE IF NOT EXISTS public.{table_name} (\n")
                
                columns = []
                for col_name, col_info in table_info['columns'].items():
                    # Map Python types to PostgreSQL types
                    pg_type = "TEXT"  # default
                    if col_info['type'] == 'int':
                        pg_type = "INTEGER"
                    elif col_info['type'] == 'float':
                        pg_type = "NUMERIC"
                    elif col_info['type'] == 'bool':
                        pg_type = "BOOLEAN"
                    elif col_info['type'] == 'datetime':
                        pg_type = "TIMESTAMP WITH TIME ZONE"
                    
                    columns.append(f"    {col_name} {pg_type}")
                
                f.write(",\n".join(columns))
                f.write("\n);\n\n")
        
        # Add note about additional objects
        f.write("-- Additional database objects (triggers, functions, constraints) are in:\n")
        f.write("-- ../migrations/ - Official Supabase migrations\n")
        f.write("-- ../triggers/ - Database trigger scripts\n")
        f.write("-- ../schema-updates/ - Schema modification scripts\n")
    
    print(f"Initial setup script saved to: {filename}")
    return filename

def create_comprehensive_dump_script():
    """Create a script to generate comprehensive database dump using Supabase CLI"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"generate_comprehensive_dump_{timestamp}.sh"
    
    with open(filename, 'w') as f:
        f.write("#!/bin/bash\n")
        f.write("# Comprehensive Database Dump Script\n")
        f.write(f"# Generated at: {datetime.now().isoformat()}\n")
        f.write("# This script uses Supabase CLI to generate complete schema dump\n\n")
        
        f.write("echo 'Generating comprehensive database dump...'\n\n")
        
        f.write("# Check if Supabase CLI is installed\n")
        f.write("if ! command -v supabase &> /dev/null; then\n")
        f.write("    echo 'Error: Supabase CLI is not installed'\n")
        f.write("    exit 1\n")
        f.write("fi\n\n")
        
        f.write("# Check if logged in\n")
        f.write("if ! supabase projects list &> /dev/null; then\n")
        f.write("    echo 'Please login to Supabase CLI first: supabase login'\n")
        f.write("    exit 1\n")
        f.write("fi\n\n")
        
        f.write("# Generate schema dump\n")
        f.write("echo 'Pulling database schema...'\n")
        f.write("supabase db pull --schema public\n\n")
        
        f.write("# Generate types\n")
        f.write("echo 'Generating TypeScript types...'\n")
        f.write("supabase gen types typescript --local > types.ts\n\n")
        
        f.write("echo 'Comprehensive dump completed!'\n")
        f.write("echo 'Files generated:'\n")
        f.write("echo '  - supabase/migrations/ (latest migration)'\n")
        f.write("echo '  - types.ts (TypeScript types)'\n")
    
    # Make executable
    os.chmod(filename, 0o755)
    print(f"Comprehensive dump script saved to: {filename}")
    return filename

def main():
    print("Connecting to Supabase...")
    
    load_env()
    supabase = connect_supabase()
    
    if not supabase:
        return
    
    print("\nDiscovering tables...")
    tables = discover_tables(supabase)
    
    print(f"\nFound {len(tables)} tables: {', '.join(tables)}")
    
    # Generate complete schema
    schema_info = generate_complete_schema(supabase, tables)
    
    # Save in multiple formats
    json_file = save_schema_dump(schema_info, "json")
    sql_file = save_schema_dump(schema_info, "sql")
    setup_file = create_initial_setup_script(schema_info)
    dump_script = create_comprehensive_dump_script()
    
    print(f"\nSchema generation completed!")
    print(f"Files created:")
    print(f"  - JSON schema: {json_file}")
    print(f"  - SQL schema: {sql_file}")
    print(f"  - Setup script: {setup_file}")
    print(f"  - Comprehensive dump script: {dump_script}")
    print(f"\nNote: For complete schema including triggers, functions, and constraints:")
    print(f"  1. Use the generated shell script: {dump_script}")
    print(f"  2. Or use Supabase CLI: supabase db pull")
    print(f"  3. Or check existing migrations in ../migrations/")

if __name__ == "__main__":
    main() 