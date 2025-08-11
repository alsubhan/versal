#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create fresh database setup script from migrations
"""

import os
import glob
from datetime import datetime

def create_fresh_script():
    """Create a fresh database setup script"""
    migrations_dir = "../../migrations"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"fresh_database_setup_{timestamp}.sql"
    
    with open(filename, 'w') as f:
        f.write("-- Fresh Database Setup Script\n")
        f.write(f"-- Generated at: {datetime.now().isoformat()}\n")
        f.write("-- This script creates a complete database from scratch\n\n")
        
        # Extensions
        f.write("-- Extensions\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n")
        f.write("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";\n\n")
        
        # Read and combine all migrations
        if os.path.exists(migrations_dir):
            migration_files = glob.glob(f"{migrations_dir}/*.sql")
            
            for file_path in sorted(migration_files):
                filename_basename = os.path.basename(file_path)
                print(f"Processing: {filename_basename}")
                
                f.write(f"-- From: {filename_basename}\n")
                f.write("-- " + "="*50 + "\n")
                
                with open(file_path, 'r') as migration_file:
                    content = migration_file.read()
                    f.write(content)
                    f.write("\n\n")
        
        f.write("-- Setup Complete!\n")
    
    print(f"Fresh setup script saved to: {filename}")
    return filename

def main():
    print("Creating fresh database setup script...")
    script_file = create_fresh_script()
    print(f"Complete! Use {script_file} to set up a fresh database")

if __name__ == "__main__":
    main() 