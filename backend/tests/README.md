# Backend Tests

This directory contains tests for the Versal backend API and database functionality.

## Test Structure

```
backend/tests/
├── __init__.py                    # Python package marker
├── conftest.py                   # Pytest configuration and fixtures
├── test_grn_connection.py        # GRN database connection tests
└── README.md                     # This file
```

## Running Tests

### Prerequisites

1. **Environment Variables**: Set up your Supabase credentials
   ```bash
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_KEY="your-service-key"
   ```

2. **Install Dependencies**: Install test dependencies
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

### Running Tests

#### Basic Tests (Schema Validation)
```bash
cd backend
python -m pytest tests/ -v
```

#### All Tests Including Integration Tests
```bash
cd backend
python -m pytest tests/ --run-integration-tests -v
```

#### Specific Test File
```bash
cd backend
python -m pytest tests/test_grn_connection.py -v
```

#### Specific Test Method
```bash
cd backend
python -m pytest tests/test_grn_connection.py::TestGRNConnection::test_database_connection -v
```

## Test Categories

### 1. Connection Tests
- Database connectivity validation
- Supabase client initialization

### 2. Schema Tests
- Table existence validation
- Required column validation
- Data type verification

### 3. Integration Tests
- **⚠️ WARNING**: These tests modify database state
- Use `--run-integration-tests` flag to enable
- Tests create and clean up test data
- Only run in development/test environments

## Test Fixtures

### `supabase_client`
- Provides configured Supabase client
- Automatically skips tests if credentials missing
- Session-scoped for performance

### `test_environment`
- Provides test environment configuration
- Includes environment variable status
- Useful for conditional test execution

## Adding New Tests

### 1. Create Test File
```python
# tests/test_your_feature.py
import pytest
from supabase import Client

class TestYourFeature:
    def test_something(self, supabase_client: Client):
        # Your test logic here
        assert True
```

### 2. Follow Naming Conventions
- Test files: `test_*.py`
- Test classes: `Test*`
- Test methods: `test_*`

### 3. Use Fixtures
- Leverage existing fixtures from `conftest.py`
- Create new fixtures as needed
- Document fixture purpose

### 4. Handle Integration Tests
- Mark integration tests with `@pytest.mark.skipif`
- Use `--run-integration-tests` flag
- Always clean up test data

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up any data created during tests
- Use unique identifiers for test data

### 2. Error Handling
- Use `pytest.fail()` for meaningful error messages
- Handle expected exceptions appropriately
- Provide clear failure descriptions

### 3. Performance
- Use session-scoped fixtures for expensive operations
- Limit database queries in tests
- Use `limit(1)` for existence checks

### 4. Documentation
- Document test purpose and scope
- Include setup requirements
- Explain complex test logic

## Environment Setup

### Development
```bash
# Set up test environment
export TEST_ENV=true
export SUPABASE_URL="your-dev-supabase-url"
export SUPABASE_SERVICE_KEY="your-dev-service-key"
```

### CI/CD
- Use separate test database
- Set `TEST_ENV=true` in CI environment
- Run integration tests in isolated environment

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   pytest.skip("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
   ```
   - Set required environment variables
   - Check `.env` file configuration

2. **Database Connection Failures**
   - Verify Supabase URL and key
   - Check network connectivity
   - Ensure database is accessible

3. **Schema Mismatches**
   - Run database migrations first
   - Check column names and types
   - Verify table existence

### Debug Mode
```bash
# Run with detailed output
python -m pytest tests/ -v -s --tb=long
```

## Migration from Standalone Scripts

The original `test_grn_connection.py` was a standalone script. It has been converted to:

1. **Proper pytest structure** with fixtures
2. **Better error handling** and assertions
3. **Integration test safety** with flags
4. **Reusable components** for other tests

This provides a foundation for comprehensive backend testing. 