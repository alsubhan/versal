"""
Pytest configuration for Versal backend tests
"""

import os
import pytest
from supabase import create_client, Client

@pytest.fixture(scope="session")
def supabase_client():
    """Create a Supabase client for testing"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        pytest.skip("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
    
    return create_client(supabase_url, supabase_key)

@pytest.fixture(scope="session")
def test_environment():
    """Check if we're in a test environment"""
    return {
        "supabase_url": os.getenv("SUPABASE_URL"),
        "supabase_key": os.getenv("SUPABASE_SERVICE_KEY"),
        "is_test_env": bool(os.getenv("TEST_ENV", "false").lower() == "true")
    } 