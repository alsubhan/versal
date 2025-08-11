"""
Tests for GRN (Goods Received Notes) database connection and schema
"""

import pytest
from supabase import Client


class TestGRNConnection:
    """Test GRN database connection and schema validation"""
    
    def test_database_connection(self, supabase_client: Client):
        """Test that we can connect to the database"""
        assert supabase_client is not None
        print("✅ Database connection successful")
    
    def test_grn_table_exists(self, supabase_client: Client):
        """Test that good_receive_notes table exists and is accessible"""
        try:
            result = supabase_client.table("good_receive_notes").select("*").limit(1).execute()
            assert result is not None
            print("✅ good_receive_notes table exists and is accessible")
        except Exception as e:
            pytest.fail(f"❌ good_receive_notes table not accessible: {str(e)}")
    
    def test_grn_items_table_exists(self, supabase_client: Client):
        """Test that good_receive_note_items table exists and is accessible"""
        try:
            result = supabase_client.table("good_receive_note_items").select("*").limit(1).execute()
            assert result is not None
            print("✅ good_receive_note_items table exists and is accessible")
        except Exception as e:
            pytest.fail(f"❌ good_receive_note_items table not accessible: {str(e)}")
    
    def test_grn_required_columns(self, supabase_client: Client):
        """Test that required columns exist in good_receive_notes table"""
        required_columns = [
            "subtotal", "tax_amount", "discount_amount", "total_amount", "rounding_adjustment"
        ]
        
        for column in required_columns:
            try:
                result = supabase_client.table("good_receive_notes").select(column).limit(1).execute()
                assert result is not None
                print(f"✅ Column '{column}' exists in good_receive_notes")
            except Exception as e:
                pytest.fail(f"❌ Column '{column}' missing from good_receive_notes: {str(e)}")
    
    def test_grn_items_required_columns(self, supabase_client: Client):
        """Test that required columns exist in good_receive_note_items table"""
        required_columns = [
            "discount", "tax", "total"
        ]
        
        for column in required_columns:
            try:
                result = supabase_client.table("good_receive_note_items").select(column).limit(1).execute()
                assert result is not None
                print(f"✅ Column '{column}' exists in good_receive_note_items")
            except Exception as e:
                pytest.fail(f"❌ Column '{column}' missing from good_receive_note_items: {str(e)}")
    
    @pytest.mark.skipif(
        not pytest.config.getoption("--run-integration-tests", default=False),
        reason="Integration test - requires --run-integration-tests flag"
    )
    def test_grn_creation_and_cleanup(self, supabase_client: Client):
        """Test creating and cleaning up a GRN record (integration test)"""
        try:
            # Test data
            test_grn = {
                "grn_number": "TEST-GRN-001",
                "purchase_order_id": "00000000-0000-0000-0000-000000000000",  # Dummy UUID
                "supplier_id": "00000000-0000-0000-0000-000000000000",  # Dummy UUID
                "received_date": "2024-01-01",
                "received_by": "00000000-0000-0000-0000-000000000000",  # Dummy UUID
                "status": "draft",
                "subtotal": 100.00,
                "tax_amount": 10.00,
                "discount_amount": 5.00,
                "total_amount": 105.00,
                "rounding_adjustment": 0.00
            }
            
            # Create test record
            result = supabase_client.table("good_receive_notes").insert(test_grn).execute()
            assert result.data is not None
            print("✅ GRN creation test successful")
            
            # Clean up - delete the test record
            if result.data:
                grn_id = result.data[0]["id"]
                supabase_client.table("good_receive_notes").delete().eq("id", grn_id).execute()
                print("✅ Test GRN cleaned up")
                
        except Exception as e:
            pytest.fail(f"❌ GRN creation test failed: {str(e)}")


def pytest_addoption(parser):
    """Add custom command line options for pytest"""
    parser.addoption(
        "--run-integration-tests",
        action="store_true",
        default=False,
        help="Run integration tests that modify database state"
    ) 