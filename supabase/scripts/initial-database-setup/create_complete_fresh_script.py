#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create a complete fresh database setup script from existing migrations
"""

import os
import sys
import glob
from datetime import datetime

def read_migration_files():
    """Read all migration files and extract their content"""
    migrations_dir = "../../migrations"
    migrations = []
    
    print("Reading migration files...")
    
    if os.path.exists(migrations_dir):
        migration_files = glob.glob(f"{migrations_dir}/*.sql")
        
        for file_path in sorted(migration_files):
            filename = os.path.basename(file_path)
            print(f"  Reading: {filename}")
            
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    migrations.append({
                        "filename": filename,
                        "content": content
                    })
            except Exception as e:
                print(f"    Error reading {filename}: {e}")
    
    return migrations

def create_complete_fresh_script(migrations):
    """Create a complete fresh database setup script"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"complete_fresh_database_setup_{timestamp}.sql"
    
    with open(filename, 'w') as f:
        f.write("-- Complete Fresh Database Setup Script\n")
        f.write(f"-- Generated at: {datetime.now().isoformat()}\n")
        f.write("-- Project ID: bmyaefeddtcbnmpzvxmf\n")
        f.write("-- This script creates a complete database from scratch\n")
        f.write("-- Extracted from existing migrations but organized as a fresh setup\n\n")
        
        # Add header with extensions
        f.write("-- Enable required extensions\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";\n\n")
        
        # Process migrations in order
        f.write("-- Database Schema Creation\n")
        f.write("-- =========================\n\n")
        
        for migration in migrations:
            f.write(f"-- From migration: {migration['filename']}\n")
            f.write("-- " + "="*50 + "\n")
            
            # Clean up the content - remove comments and organize
            content = migration['content']
            
            # Remove migration-specific comments
            lines = content.split('\n')
            cleaned_lines = []
            
            for line in lines:
                # Skip migration-specific comments but keep important ones
                if line.strip().startswith('--') and any(keyword in line.lower() for keyword in ['migration', 'timestamp', 'id:']):
                    continue
                cleaned_lines.append(line)
            
            # Write cleaned content
            f.write('\n'.join(cleaned_lines))
            f.write("\n\n")
        
        # Add footer
        f.write("-- Setup Complete!\n")
        f.write("-- This script creates a complete database schema from scratch\n")
        f.write("-- All tables, triggers, functions, indexes, and constraints are included\n")
    
    print(f"Complete fresh setup script saved to: {filename}")
    return filename

def create_organized_setup_script(migrations):
    """Create an organized setup script with sections"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"organized_database_setup_{timestamp}.sql"
    
    with open(filename, 'w') as f:
        f.write("-- Organized Database Setup Script\n")
        f.write(f"-- Generated at: {datetime.now().isoformat()}\n")
        f.write("-- Project ID: bmyaefeddtcbnmpzvxmf\n")
        f.write("-- This script creates a complete database with organized sections\n\n")
        
        # Extensions
        f.write("-- =========================\n")
        f.write("-- EXTENSIONS\n")
        f.write("-- =========================\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";\n\n")
        
        # Tables
        f.write("-- =========================\n")
        f.write("-- TABLES\n")
        f.write("-- =========================\n")
        
        # Extract table creation statements
        table_creations = []
        for migration in migrations:
            content = migration['content']
            if 'CREATE TABLE' in content.upper():
                table_creations.append({
                    "filename": migration['filename'],
                    "content": content
                })
        
        for table_migration in table_creations:
            f.write(f"-- From: {table_migration['filename']}\n")
            f.write(table_migration['content'])
            f.write("\n\n")
        
        # Functions
        f.write("-- =========================\n")
        f.write("-- FUNCTIONS\n")
        f.write("-- =========================\n")
        
        function_creations = []
        for migration in migrations:
            content = migration['content']
            if 'CREATE FUNCTION' in content.upper() or 'CREATE OR REPLACE FUNCTION' in content.upper():
                function_creations.append({
                    "filename": migration['filename'],
                    "content": content
                })
        
        for func_migration in function_creations:
            f.write(f"-- From: {func_migration['filename']}\n")
            f.write(func_migration['content'])
            f.write("\n\n")
        
        # Triggers
        f.write("-- =========================\n")
        f.write("-- TRIGGERS\n")
        f.write("-- =========================\n")
        
        trigger_creations = []
        for migration in migrations:
            content = migration['content']
            if 'CREATE TRIGGER' in content.upper():
                trigger_creations.append({
                    "filename": migration['filename'],
                    "content": content
                })
        
        for trigger_migration in trigger_creations:
            f.write(f"-- From: {trigger_migration['filename']}\n")
            f.write(trigger_migration['content'])
            f.write("\n\n")
        
        # Indexes
        f.write("-- =========================\n")
        f.write("-- INDEXES\n")
        f.write("-- =========================\n")
        
        index_creations = []
        for migration in migrations:
            content = migration['content']
            if 'CREATE INDEX' in content.upper():
                index_creations.append({
                    "filename": migration['filename'],
                    "content": content
                })
        
        for index_migration in index_creations:
            f.write(f"-- From: {index_migration['filename']}\n")
            f.write(index_migration['content'])
            f.write("\n\n")
        
        # Constraints
        f.write("-- =========================\n")
        f.write("-- CONSTRAINTS\n")
        f.write("-- =========================\n")
        
        constraint_creations = []
        for migration in migrations:
            content = migration['content']
            if 'ALTER TABLE' in content.upper() and 'CONSTRAINT' in content.upper():
                constraint_creations.append({
                    "filename": migration['filename'],
                    "content": content
                })
        
        for constraint_migration in constraint_creations:
            f.write(f"-- From: {constraint_migration['filename']}\n")
            f.write(constraint_migration['content'])
            f.write("\n\n")
        
        # Data inserts
        f.write("-- =========================\n")
        f.write("-- INITIAL DATA\n")
        f.write("-- =========================\n")
        
        data_inserts = []
        for migration in migrations:
            content = migration['content']
            if 'INSERT INTO' in content.upper():
                data_inserts.append({
                    "filename": migration['filename'],
                    "content": content
                })
        
        for data_migration in data_inserts:
            f.write(f"-- From: {data_migration['filename']}\n")
            f.write(data_migration['content'])
            f.write("\n\n")
        
        f.write("-- Setup Complete!\n")
        f.write("-- This organized script creates a complete database with all objects\n")
    
    print(f"Organized setup script saved to: {filename}")
    return filename

def main():
    print("Creating complete fresh database setup scripts...")
    
    # Read all migration files
    migrations = read_migration_files()
    
    if not migrations:
        print("No migration files found!")
        return
    
    print(f"\nFound {len(migrations)} migration files")
    
    # Create complete fresh script
    complete_script = create_complete_fresh_script(migrations)
    
    # Create organized script
    organized_script = create_organized_setup_script(migrations)
    
    print(f"\nFresh database setup scripts created!")
    print(f"Files created:")
    print(f"  - Complete fresh script: {complete_script}")
    print(f"  - Organized script: {organized_script}")
    
    print(f"\nUsage:")
    print(f"  1. {complete_script} - Complete setup in migration order")
    print(f"  2. {organized_script} - Organized setup by object type")
    print(f"\nNote: These scripts create a fresh database from scratch")
    print(f"      No migration files needed for future use")

if __name__ == "__main__":
    main() 