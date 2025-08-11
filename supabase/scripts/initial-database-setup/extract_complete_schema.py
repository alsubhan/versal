#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract complete database schema including all objects from migrations and live database
"""

import os
import sys
import glob
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

def analyze_migration_files():
    """Analyze existing migration files to extract database objects"""
    migrations_dir = "../../migrations"
    schema_objects = {
        "tables": set(),
        "triggers": set(),
        "functions": set(),
        "indexes": set(),
        "enums": set(),
        "extensions": set(),
        "constraints": set(),
        "views": set()
    }
    
    print("Analyzing migration files...")
    
    if os.path.exists(migrations_dir):
        migration_files = glob.glob(f"{migrations_dir}/*.sql")
        
        for file_path in sorted(migration_files):
            print(f"  Analyzing: {os.path.basename(file_path)}")
            
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    
                    # Extract table names
                    import re
                    
                    # Find CREATE TABLE statements
                    table_matches = re.findall(r'CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)', content, re.IGNORECASE)
                    schema_objects["tables"].update(table_matches)
                    
                    # Find CREATE TRIGGER statements
                    trigger_matches = re.findall(r'CREATE TRIGGER (\w+)', content, re.IGNORECASE)
                    schema_objects["triggers"].update(trigger_matches)
                    
                    # Find CREATE FUNCTION statements
                    function_matches = re.findall(r'CREATE (?:OR REPLACE )?FUNCTION (\w+)', content, re.IGNORECASE)
                    schema_objects["functions"].update(function_matches)
                    
                    # Find CREATE INDEX statements
                    index_matches = re.findall(r'CREATE (?:UNIQUE )?INDEX (\w+)', content, re.IGNORECASE)
                    schema_objects["indexes"].update(index_matches)
                    
                    # Find CREATE TYPE statements (enums)
                    enum_matches = re.findall(r'CREATE TYPE (\w+)', content, re.IGNORECASE)
                    schema_objects["enums"].update(enum_matches)
                    
                    # Find CREATE EXTENSION statements
                    extension_matches = re.findall(r'CREATE EXTENSION (\w+)', content, re.IGNORECASE)
                    schema_objects["extensions"].update(extension_matches)
                    
                    # Find CONSTRAINT statements
                    constraint_matches = re.findall(r'CONSTRAINT (\w+)', content, re.IGNORECASE)
                    schema_objects["constraints"].update(constraint_matches)
                    
                    # Find CREATE VIEW statements
                    view_matches = re.findall(r'CREATE (?:OR REPLACE )?VIEW (\w+)', content, re.IGNORECASE)
                    schema_objects["views"].update(view_matches)
                    
            except Exception as e:
                print(f"    Error reading {file_path}: {e}")
    
    # Convert sets to lists for JSON serialization
    return {k: list(v) for k, v in schema_objects.items()}

def analyze_script_files():
    """Analyze script files to extract additional database objects"""
    scripts_dir = "../"
    script_objects = {
        "triggers": set(),
        "functions": set(),
        "schema_updates": set()
    }
    
    print("Analyzing script files...")
    
    # Check triggers directory
    triggers_dir = f"{scripts_dir}/triggers"
    if os.path.exists(triggers_dir):
        trigger_files = glob.glob(f"{triggers_dir}/*.sql")
        for file_path in trigger_files:
            print(f"  Analyzing trigger: {os.path.basename(file_path)}")
            script_objects["triggers"].add(os.path.basename(file_path))
    
    # Check schema-updates directory
    schema_dir = f"{scripts_dir}/schema-updates"
    if os.path.exists(schema_dir):
        schema_files = glob.glob(f"{schema_dir}/*.sql")
        for file_path in schema_files:
            print(f"  Analyzing schema update: {os.path.basename(file_path)}")
            script_objects["schema_updates"].add(os.path.basename(file_path))
    
    return {k: list(v) for k, v in script_objects.items()}

def get_live_table_info(supabase):
    """Get live table information from database"""
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
            
            # Get column information
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
                
        except Exception as e:
            live_tables[table] = {
                "exists": False,
                "error": str(e)
            }
    
    return live_tables, existing_tables

def create_comprehensive_schema_dump():
    """Create a comprehensive schema dump combining all sources"""
    print("Creating comprehensive schema dump...")
    
    # Load environment and connect
    load_env()
    supabase = connect_supabase()
    
    if not supabase:
        return None
    
    # Get information from different sources
    migration_objects = analyze_migration_files()
    script_objects = analyze_script_files()
    live_tables, existing_tables = get_live_table_info(supabase)
    
    # Combine all information
    comprehensive_schema = {
        "generated_at": datetime.now().isoformat(),
        "project_id": "bmyaefeddtcbnmpzvxmf",
        "sources": {
            "migrations": "Analyzed from supabase/migrations/",
            "scripts": "Analyzed from supabase/scripts/",
            "live_database": "Connected via Supabase API"
        },
        "database_objects": {
            "tables": {
                "live_tables": live_tables,
                "migration_tables": migration_objects["tables"]
            },
            "triggers": {
                "migration_triggers": migration_objects["triggers"],
                "script_triggers": script_objects["triggers"]
            },
            "functions": {
                "migration_functions": migration_objects["functions"]
            },
            "indexes": {
                "migration_indexes": migration_objects["indexes"]
            },
            "enums": {
                "migration_enums": migration_objects["enums"]
            },
            "extensions": {
                "migration_extensions": migration_objects["extensions"]
            },
            "constraints": {
                "migration_constraints": migration_objects["constraints"]
            },
            "views": {
                "migration_views": migration_objects["views"]
            },
            "schema_updates": {
                "script_updates": script_objects["schema_updates"]
            }
        },
        "summary": {
            "total_tables": len(existing_tables),
            "total_triggers": len(migration_objects["triggers"]) + len(script_objects["triggers"]),
            "total_functions": len(migration_objects["functions"]),
            "total_indexes": len(migration_objects["indexes"]),
            "total_enums": len(migration_objects["enums"]),
            "total_extensions": len(migration_objects["extensions"]),
            "total_constraints": len(migration_objects["constraints"]),
            "total_views": len(migration_objects["views"]),
            "total_schema_updates": len(script_objects["schema_updates"])
        }
    }
    
    return comprehensive_schema

def save_comprehensive_dump(schema_info):
    """Save comprehensive schema dump"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save JSON dump
    json_filename = f"comprehensive_schema_dump_{timestamp}.json"
    with open(json_filename, 'w') as f:
        json.dump(schema_info, f, indent=2)
    
    # Save SQL summary
    sql_filename = f"comprehensive_schema_summary_{timestamp}.sql"
    with open(sql_filename, 'w') as f:
        f.write("-- Comprehensive Database Schema Summary\n")
        f.write(f"-- Generated at: {schema_info['generated_at']}\n")
        f.write(f"-- Project ID: {schema_info['project_id']}\n\n")
        
        f.write("-- Sources:\n")
        for source, description in schema_info['sources'].items():
            f.write(f"-- {source}: {description}\n")
        f.write("\n")
        
        f.write("-- Summary:\n")
        for key, value in schema_info['summary'].items():
            f.write(f"-- {key.replace('_', ' ').title()}: {value}\n")
        f.write("\n")
        
        f.write("-- Database Objects Found:\n\n")
        
        # Tables
        f.write("-- TABLES:\n")
        f.write(f"-- Live tables: {len(schema_info['database_objects']['tables']['live_tables'])}\n")
        for table in schema_info['database_objects']['tables']['live_tables']:
            f.write(f"--   {table}\n")
        f.write("\n")
        
        # Triggers
        f.write("-- TRIGGERS:\n")
        triggers = schema_info['database_objects']['triggers']
        f.write(f"-- Migration triggers: {len(triggers['migration_triggers'])}\n")
        for trigger in triggers['migration_triggers']:
            f.write(f"--   {trigger}\n")
        f.write(f"-- Script triggers: {len(triggers['script_triggers'])}\n")
        for trigger in triggers['script_triggers']:
            f.write(f"--   {trigger}\n")
        f.write("\n")
        
        # Functions
        f.write("-- FUNCTIONS:\n")
        functions = schema_info['database_objects']['functions']['migration_functions']
        f.write(f"-- Total functions: {len(functions)}\n")
        for func in functions:
            f.write(f"--   {func}\n")
        f.write("\n")
        
        # Indexes
        f.write("-- INDEXES:\n")
        indexes = schema_info['database_objects']['indexes']['migration_indexes']
        f.write(f"-- Total indexes: {len(indexes)}\n")
        for index in indexes:
            f.write(f"--   {index}\n")
        f.write("\n")
        
        # Enums
        f.write("-- ENUMS:\n")
        enums = schema_info['database_objects']['enums']['migration_enums']
        f.write(f"-- Total enums: {len(enums)}\n")
        for enum in enums:
            f.write(f"--   {enum}\n")
        f.write("\n")
        
        # Extensions
        f.write("-- EXTENSIONS:\n")
        extensions = schema_info['database_objects']['extensions']['migration_extensions']
        f.write(f"-- Total extensions: {len(extensions)}\n")
        for ext in extensions:
            f.write(f"--   {ext}\n")
        f.write("\n")
        
        # Constraints
        f.write("-- CONSTRAINTS:\n")
        constraints = schema_info['database_objects']['constraints']['migration_constraints']
        f.write(f"-- Total constraints: {len(constraints)}\n")
        for constraint in constraints:
            f.write(f"--   {constraint}\n")
        f.write("\n")
        
        # Views
        f.write("-- VIEWS:\n")
        views = schema_info['database_objects']['views']['migration_views']
        f.write(f"-- Total views: {len(views)}\n")
        for view in views:
            f.write(f"--   {view}\n")
        f.write("\n")
        
        # Schema Updates
        f.write("-- SCHEMA UPDATES:\n")
        updates = schema_info['database_objects']['schema_updates']['script_updates']
        f.write(f"-- Total schema updates: {len(updates)}\n")
        for update in updates:
            f.write(f"--   {update}\n")
        f.write("\n")
        
        f.write("-- For complete schema including all objects:\n")
        f.write("-- 1. Check supabase/migrations/ for official migrations\n")
        f.write("-- 2. Check supabase/scripts/ for development scripts\n")
        f.write("-- 3. Use Supabase CLI: supabase db pull\n")
    
    print(f"Comprehensive schema dump saved to: {json_filename}")
    print(f"Schema summary saved to: {sql_filename}")
    
    return json_filename, sql_filename

def main():
    print("Extracting comprehensive database schema...")
    
    # Generate comprehensive schema
    schema_info = create_comprehensive_schema_dump()
    
    if schema_info:
        # Save dumps
        json_file, sql_file = save_comprehensive_dump(schema_info)
        
        print(f"\nComprehensive schema extraction completed!")
        print(f"Files created:")
        print(f"  - JSON dump: {json_file}")
        print(f"  - SQL summary: {sql_file}")
        
        # Print summary
        summary = schema_info['summary']
        print(f"\nDatabase Summary:")
        print(f"  Tables: {summary['total_tables']}")
        print(f"  Triggers: {summary['total_triggers']}")
        print(f"  Functions: {summary['total_functions']}")
        print(f"  Indexes: {summary['total_indexes']}")
        print(f"  Enums: {summary['total_enums']}")
        print(f"  Extensions: {summary['total_extensions']}")
        print(f"  Constraints: {summary['total_constraints']}")
        print(f"  Views: {summary['total_views']}")
        print(f"  Schema Updates: {summary['total_schema_updates']}")
        
        print(f"\nNote: This is a comprehensive analysis combining:")
        print(f"  - Live database connection")
        print(f"  - Migration file analysis")
        print(f"  - Script file analysis")
    else:
        print("Failed to extract comprehensive schema")

if __name__ == "__main__":
    main() 