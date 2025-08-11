#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Startup script for Versal API with DEBUG mode support

This script handles the --debug flag and sets the appropriate environment variable
before starting the uvicorn server.
"""

import os
import sys
import subprocess

def main():
    # Check if --debug flag is provided
    debug_mode = "--debug" in sys.argv
    
    # Remove --debug from sys.argv to avoid uvicorn errors
    args = [arg for arg in sys.argv if arg != "--debug"]
    
    if debug_mode:
        print("🔧 DEBUG MODE ENABLED via command line flag")
        # Set environment variable for debug mode
        os.environ["DEBUG"] = "true"
    else:
        print("🚀 PRODUCTION MODE - Debug features are disabled")
        # Ensure DEBUG is not set or is false
        if "DEBUG" in os.environ:
            del os.environ["DEBUG"]
    
    # Build uvicorn command
    uvicorn_cmd = [
        "uvicorn", 
        "main:app", 
        "--reload", 
        "--port", "8000"
    ]
    
    # Add any additional arguments that were passed
    if len(args) > 1:  # Skip the script name
        uvicorn_cmd.extend(args[1:])
    
    print(f"Starting server with command: {' '.join(uvicorn_cmd)}")
    
    # Start the server
    try:
        subprocess.run(uvicorn_cmd, check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 