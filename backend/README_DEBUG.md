# DEBUG Mode for Versal API

The Versal API now supports a DEBUG mode that enables additional debugging endpoints and features for troubleshooting.

## How to Enable DEBUG Mode

### Method 1: Environment Variable
Set the `DEBUG` environment variable to `true`:

```bash
export DEBUG=true
uvicorn main:app --reload --port 8000
```

### Method 2: Command Line Flag (Recommended)
Use the `--debug` flag with the startup script:

```bash
python3 start_server.py --debug
```

### Method 3: Direct Python Execution
Run the main.py file directly with the debug flag:

```bash
python3 main.py --debug
```

**Note**: Make sure to activate your virtual environment first:
```bash
source venv/bin/activate
```

## DEBUG Mode Features

When DEBUG mode is enabled, you'll see:
- 🔧 DEBUG MODE ENABLED message in the console
- Additional debug endpoints become available
- Enhanced error logging and debugging information
- Detailed debug logs for database operations, permission checks, and data processing

When DEBUG mode is disabled (production mode):
- 🚀 PRODUCTION MODE message in the console
- Debug endpoints are disabled (return 403 Forbidden)
- Minimal logging - only essential error messages
- Clean console output without verbose debug information

## Available Debug Endpoints

When DEBUG mode is active, the following endpoints become available:

### `/debug/status`
Get the current debug mode status and list of available debug endpoints.

### `/debug/roles-schema`
Test the roles table schema and accessibility.

### `/debug/profiles-schema`
Test the profiles table schema and accessibility.

### `/debug/stock-levels-schema`
Test the stock_levels table schema and accessibility.

### `/debug/inventory-transactions-schema`
Test the inventory_transactions table schema and accessibility.

### `/debug/products`
Test products table accessibility and stock levels relationships.

### `/debug/stock-levels`
Test direct access to stock_levels table with sample data.

## Production Mode

When DEBUG mode is disabled (default), you'll see:
- 🚀 PRODUCTION MODE message in the console
- Debug endpoints return 403 Forbidden errors
- Standard production behavior

## Security

- Debug endpoints are only available when DEBUG mode is explicitly enabled
- Debug endpoints are protected by the `@require_debug_mode()` decorator
- In production mode, all debug endpoints return 403 Forbidden errors

## Example Usage

### Start in Production Mode (Default)
```bash
# Activate virtual environment first
source venv/bin/activate

# Start server
uvicorn main:app --reload --port 8000
```

### Start in Debug Mode
```bash
# Activate virtual environment first
source venv/bin/activate

# Method 1: Environment variable
export DEBUG=true
uvicorn main:app --reload --port 8000

# Method 2: Command line flag (Recommended)
python3 start_server.py --debug

# Method 3: Direct execution
python3 main.py --debug
```

### Check Debug Status
```bash
curl http://localhost:8000/debug/status
```

### Test Database Schema
```bash
curl http://localhost:8000/debug/roles-schema
curl http://localhost:8000/debug/profiles-schema
curl http://localhost:8000/debug/stock-levels-schema
```

## Troubleshooting

If you encounter issues:

1. **Debug endpoints not working**: Ensure DEBUG mode is enabled
2. **403 Forbidden errors**: Check that you're running with `--debug` flag or `DEBUG=true`
3. **Database connection issues**: Use debug endpoints to test table accessibility
4. **Schema issues**: Use debug endpoints to verify table structure

## Environment Variables

- `DEBUG=true` - Enables debug mode
- `DEBUG=false` or unset - Production mode (default) 