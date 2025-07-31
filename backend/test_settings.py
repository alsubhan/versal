# -*- coding: utf-8 -*-
import os
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Test the system settings table directly
try:
    result = supabase.table('system_settings').select('*').limit(1).execute()
    print('Database connection works')
    if result.data:
        sample = result.data[0]
        print(f'Sample setting: {sample}')
        print(f'Setting value type: {type(sample["setting_value"])}')
        print(f'Setting value: {sample["setting_value"]}')
    else:
        print('No data found')
except Exception as e:
    print(f'Database error: {e}')

# Test the to_camel_case_system_setting function
def to_camel_case_system_setting(system_setting):
    import json
    
    # Parse the JSONB value based on its type
    setting_value = system_setting["setting_value"]
    setting_type = system_setting.get("setting_type", "string")
    
    print(f"Processing setting: {system_setting['setting_key']}")
    print(f"Original value: {setting_value} (type: {type(setting_value)})")
    print(f"Setting type: {setting_type}")
    
    # Convert JSONB value to appropriate type
    if setting_type == "string":
        # For strings, the JSONB value is a JSON string, so we need to parse it
        if isinstance(setting_value, str):
            try:
                parsed_value = json.loads(setting_value)
                print(f"Parsed string value: {parsed_value}")
            except:
                parsed_value = setting_value
                print(f"Failed to parse, using original: {parsed_value}")
        else:
            parsed_value = setting_value
            print(f"Not a string, using as-is: {parsed_value}")
    elif setting_type == "number":
        # For numbers, the JSONB value should be a number
        parsed_value = setting_value
        print(f"Number value: {parsed_value}")
    elif setting_type == "boolean":
        # For booleans, the JSONB value should be a boolean
        parsed_value = setting_value
        print(f"Boolean value: {parsed_value}")
    else:
        # For other types (like json), keep as is
        parsed_value = setting_value
        print(f"Other type value: {parsed_value}")
    
    return {
        "id": system_setting["id"],
        "key": system_setting["setting_key"],
        "value": parsed_value,
        "type": setting_type,
        "description": system_setting.get("description"),
        "isPublic": system_setting.get("is_public", False),
        "createdAt": system_setting.get("created_at"),
        "updatedAt": system_setting.get("updated_at")
    }

# Test with a sample setting
if result.data:
    try:
        converted = to_camel_case_system_setting(result.data[0])
        print(f"Conversion successful: {converted}")
    except Exception as e:
        print(f"Conversion error: {e}") 