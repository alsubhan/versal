#!/usr/bin/env python3
"""
Simple test runner for Versal backend tests
"""

import os
import sys
import subprocess

def main():
    """Run the test suite"""
    print("🚀 Running Versal Backend Tests...")
    
    # Check if we're in the backend directory
    if not os.path.exists("tests"):
        print("❌ Please run this script from the backend directory")
        sys.exit(1)
    
    # Check environment variables
    required_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please set them before running tests:")
        for var in missing_vars:
            print(f"  export {var}='your-value'")
        sys.exit(1)
    
    # Run basic tests
    print("\n📋 Running basic tests (schema validation)...")
    result = subprocess.run([
        sys.executable, "-m", "pytest", "tests/", "-v"
    ], capture_output=False)
    
    if result.returncode != 0:
        print("\n❌ Basic tests failed!")
        sys.exit(result.returncode)
    
    # Ask about integration tests
    print("\n🤔 Run integration tests? (y/N): ", end="")
    response = input().strip().lower()
    
    if response in ['y', 'yes']:
        print("\n🧪 Running integration tests...")
        result = subprocess.run([
            sys.executable, "-m", "pytest", "tests/", "--run-integration-tests", "-v"
        ], capture_output=False)
        
        if result.returncode != 0:
            print("\n❌ Integration tests failed!")
            sys.exit(result.returncode)
    
    print("\n✅ All tests completed successfully!")

if __name__ == "__main__":
    main() 