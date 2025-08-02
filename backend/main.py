from fastapi import FastAPI, Depends, HTTPException, status, Security, Body
import os
import json
from supabase import create_client, Client
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests
from jose import jwt as jose_jwt
from jose.exceptions import JWTError
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

load_dotenv()  # Load environment variables from .env file

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",  # Frontend development server
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",  # React default port
        "http://127.0.0.1:8080",  # Alternative localhost
        "http://127.0.0.1:5173",  # Alternative localhost
        "http://127.0.0.1:3000",  # Alternative localhost
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL environment variable is not set")

if not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_SERVICE_KEY environment variable is not set")

SUPABASE_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
bearer_scheme = HTTPBearer()

# Cache the JWK set
_jwk_set = None

def get_jwk_set():
    global _jwk_set
    if _jwk_set is None:
        try:
            resp = requests.get(SUPABASE_JWKS_URL)
            resp.raise_for_status()
            jwk_data = resp.json()
            # Ensure we return the keys array, not the entire response
            if isinstance(jwk_data, dict) and "keys" in jwk_data:
                _jwk_set = jwk_data
            else:
                _jwk_set = jwk_data
        except Exception as e:
            # If JWK fetch fails, return a minimal valid JWK set
            _jwk_set = {"keys": []}
    return _jwk_set

def verify_jwt(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)):
    token = credentials.credentials
    jwk_set = get_jwk_set()
    try:
        # python-jose will automatically select the correct key from the set
        payload = jose_jwt.decode(token, jwk_set, algorithms=["ES256"], options={"verify_aud": False})
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")

def to_camel_case_category(category):
    return {
        **category,
        "isActive": category.get("is_active"),
        "parentId": category.get("parent_id"),
        "createdAt": category.get("created_at"),
        "updatedAt": category.get("updated_at"),
    }

def to_camel_case_role(role):
    """Convert role data from snake_case to camelCase"""
    return {
        "id": role.get("id"),
        "name": role.get("name"),
        "description": role.get("description"),
        "permissions": role.get("permissions", []),
        "createdAt": role.get("created_at"),
        "updatedAt": role.get("updated_at")
    }

def to_camel_case_user(user):
    return {
        **user,
        "role": user.get("role"),
        "createdAt": user.get("created_at"),
        "updatedAt": user.get("updated_at"),
    }

def require_role(allowed_roles):
    def decorator(payload=Depends(verify_jwt)):
        user_role = (
            payload.get("user_metadata", {}).get("role")
            or payload.get("role_name")
        )
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: insufficient permissions"
            )
        return payload
    return decorator

def require_permission(required_permission):
    def decorator(payload=Depends(verify_jwt)):
        # Get user ID from JWT payload
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        # Get user's role and permissions from profiles and roles tables
        try:
            print(f"Checking permission '{required_permission}' for user {user_id}")
            
            # Get user profile with role_id
            profile_data = supabase.table("profiles").select("role_id").eq("id", user_id).execute()
            if not profile_data.data:
                print(f"User profile not found for user {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User profile not found"
                )
            
            user_role_id = profile_data.data[0].get("role_id")
            if not user_role_id:
                print(f"User {user_id} has no assigned role")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no assigned role"
                )
            
            print(f"User {user_id} has role_id: {user_role_id}")
            
            # Get role name from roles table
            role_data = supabase.table("roles").select("name, permissions").eq("id", user_role_id).execute()
            if not role_data.data:
                print(f"Role not found for role_id {user_role_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role not found"
                )
            
            user_role_name = role_data.data[0].get("name")
            user_permissions = role_data.data[0].get("permissions", [])
            
            print(f"User {user_id} has role '{user_role_name}' with permissions: {user_permissions}")
            
            # Parse permissions if it's a JSON string
            if isinstance(user_permissions, str):
                try:
                    user_permissions = json.loads(user_permissions)
                except json.JSONDecodeError:
                    user_permissions = []
            
            # Check if user has the required permission
            if required_permission not in user_permissions:
                print(f"User {user_id} missing permission '{required_permission}'. Available: {user_permissions}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: missing permission '{required_permission}'"
                )
            
            print(f"Permission '{required_permission}' granted for user {user_id}")
            return payload
            
        except Exception as e:
            print(f"Error checking permissions for user {user_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error checking permissions: {str(e)}"
            )
    
    return decorator

# Utility functions for camelCase conversion
def to_camel_case_unit(unit):
    return {
        "id": unit["id"],
        "name": unit["name"],
        "abbreviation": unit["abbreviation"],
        "description": unit.get("description"),
        "is_active": unit.get("is_active", True),
        "createdAt": unit.get("created_at"),
        "updatedAt": unit.get("updated_at")
    }

def to_camel_case_tax(tax):
    return {
        "id": tax["id"],
        "name": tax["name"],
        "rate": float(tax["rate"]) * 100 if tax.get("rate") else 0,  # Convert decimal to percentage
        "isDefault": tax.get("is_default", False),
        "appliedTo": tax.get("applied_to", "products"),
        "description": tax.get("description"),
        "isActive": tax.get("is_active", True),
        "createdAt": tax.get("created_at"),
        "updatedAt": tax.get("updated_at")
    }

def to_camel_case_supplier(supplier):
    # Parse JSONB addresses if they exist
    billing_address = supplier.get("billing_address")
    shipping_address = supplier.get("shipping_address")
    
    # If addresses are strings (JSON), try to parse them
    if isinstance(billing_address, str):
        try:
            import json
            billing_address = json.loads(billing_address)
        except:
            billing_address = None
    
    if isinstance(shipping_address, str):
        try:
            import json
            shipping_address = json.loads(shipping_address)
        except:
            shipping_address = None
    
    return {
        "id": supplier["id"],
        "name": supplier["name"],
        "contactName": supplier["contact_name"],
        "email": supplier.get("email"),
        "phone": supplier.get("phone"),
        "address": supplier.get("address"),
        "billingAddress": billing_address or {},
        "shippingAddress": shipping_address or {},
        "paymentTerms": supplier.get("payment_terms"),
        "taxId": supplier.get("tax_id"),
        "notes": supplier.get("notes"),
        "isActive": supplier.get("is_active", True),
        "createdAt": supplier.get("created_at"),
        "updatedAt": supplier.get("updated_at")
    }

def to_camel_case_customer(customer):
    # Parse JSONB addresses if they exist
    billing_address = customer.get("billing_address")
    shipping_address = customer.get("shipping_address")
    
    # If addresses are strings (JSON), try to parse them
    if isinstance(billing_address, str):
        try:
            import json
            billing_address = json.loads(billing_address)
        except:
            billing_address = None
    
    if isinstance(shipping_address, str):
        try:
            import json
            shipping_address = json.loads(shipping_address)
        except:
            shipping_address = None
    
    return {
        "id": customer["id"],
        "name": customer["name"],
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "billingAddress": billing_address or {},
        "shippingAddress": shipping_address or {},
        "taxId": customer.get("tax_id"),
        "notes": customer.get("notes"),
        "creditLimit": float(customer["credit_limit"]) if customer.get("credit_limit") else 0,
        "currentCredit": float(customer["current_credit"]) if customer.get("current_credit") else 0,
        "customerType": customer.get("customer_type", "retail"),
        "isActive": customer.get("is_active", True),
        "createdAt": customer.get("created_at"),
        "updatedAt": customer.get("updated_at")
    }

def to_camel_case_credit_note(credit_note):
    return {
        "id": credit_note["id"],
        "customerId": credit_note["customer_id"],
        "customerName": credit_note.get("customer_name"),
        "invoiceNumber": credit_note.get("invoice_number"),
        "creditNoteNumber": credit_note.get("credit_note_number"),
        "issueDate": credit_note.get("issue_date"),
        "dueDate": credit_note.get("due_date"),
        "subtotal": float(credit_note["subtotal"]) if credit_note.get("subtotal") else 0,
        "taxAmount": float(credit_note["tax_amount"]) if credit_note.get("tax_amount") else 0,
        "totalAmount": float(credit_note["total_amount"]) if credit_note.get("total_amount") else 0,
        "status": credit_note.get("status", "draft"),
        "notes": credit_note.get("notes"),
        "createdAt": credit_note.get("created_at"),
        "updatedAt": credit_note.get("updated_at")
    }

def to_camel_case_stock_level(stock_level):
    return {
        "id": stock_level.get("id"),
        "productId": stock_level.get("product_id"),
        "productName": stock_level.get("product_name"),
        "skuCode": stock_level.get("sku_code"),
        "locationId": stock_level.get("location_id"),
        "locationName": stock_level.get("location_name"),
        "quantity": int(stock_level.get("quantity_on_hand", 0)) if stock_level.get("quantity_on_hand") is not None else 0,
        "quantityReserved": int(stock_level.get("quantity_reserved", 0)) if stock_level.get("quantity_reserved") is not None else 0,
        "quantityAvailable": int(stock_level.get("quantity_available", 0)) if stock_level.get("quantity_available") is not None else 0,
        "minStockLevel": 0,  # Not in schema, default to 0
        "maxStockLevel": 0,  # Not in schema, default to 0
        "reorderPoint": 0,   # Not in schema, default to 0
        "lastUpdated": stock_level.get("last_updated")
    }

def to_camel_case_inventory_movement(movement):
    return {
        "id": movement.get("id"),
        "productId": movement.get("product_id"),
        "productName": movement.get("product_name"),
        "skuCode": movement.get("sku_code"),
        "type": movement.get("type"),
        "quantity": int(movement.get("quantity", 0)) if movement.get("quantity") is not None else 0,
        "previousStock": int(movement.get("previous_stock", 0)) if movement.get("previous_stock") is not None else 0,
        "newStock": int(movement.get("new_stock", 0)) if movement.get("new_stock") is not None else 0,
        "reference": movement.get("reference"),
        "notes": movement.get("notes"),
        "createdBy": movement.get("created_by"),
        "createdAt": movement.get("created_at")
    }

def to_camel_case_location(location):
    return {
        "id": location.get("id"),
        "name": location.get("name"),
        "description": location.get("description"),
        "address": location.get("address"),
        "isActive": location.get("is_active", True),
        "createdAt": location.get("created_at"),
        "updatedAt": location.get("updated_at")
    }

def to_camel_case_user_setting(user_setting):
    return {
        "id": user_setting["id"],
        "userId": user_setting["user_id"],
        "theme": user_setting.get("theme", "light"),
        "language": user_setting.get("language", "en"),
        "notifications": user_setting.get("notifications", {}),
        "preferences": user_setting.get("preferences", {}),
        "createdAt": user_setting.get("created_at"),
        "updatedAt": user_setting.get("updated_at")
    }

def to_camel_case_system_setting(system_setting):
    # Parse the JSONB value based on its type
    setting_value = system_setting["setting_value"]
    setting_type = system_setting.get("setting_type", "string")
    
    # Convert JSONB value to appropriate type
    if setting_type == "string":
        # For strings, the JSONB value is a JSON string, so we need to parse it
        if isinstance(setting_value, str):
            try:
                parsed_value = json.loads(setting_value)
            except:
                parsed_value = setting_value
        else:
            parsed_value = setting_value
    elif setting_type == "number":
        # For numbers, the JSONB value should be a number
        parsed_value = setting_value
    elif setting_type == "boolean":
        # For booleans, the JSONB value should be a boolean
        parsed_value = setting_value
    else:
        # For other types (like json), keep as is
        parsed_value = setting_value
    
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

@app.get("/")
def read_root():
    return {"message": "Hello, FastAPI!"}

@app.get("/products")
def get_products(payload=Depends(verify_jwt)):
    try:
        print("Products endpoint: Starting query with stock_levels...")
        # Query products with related category, unit, and stock data
        # Use specific relationship names to avoid conflicts
        products_data = supabase.table("products").select("""
            *,
            categories!products_category_id_fkey(name),
            units(name, abbreviation),
            stock_levels(quantity_on_hand, quantity_available)
        """).execute()
        
        print(f"Products endpoint: Query successful, got {len(products_data.data) if products_data.data else 0} products")
        
        if products_data.data:
            # Process the data to ensure stock_levels is always an array
            processed_data = []
            for product in products_data.data:
                print(f"Processing product {product.get('name', 'Unknown')}: stock_levels = {product.get('stock_levels')}")
                print(f"Product {product.get('name', 'Unknown')}: reorder_point = {product.get('reorder_point')} (type: {type(product.get('reorder_point'))})")
                # Convert stock_levels object to array if it's not already
                if product.get('stock_levels') and not isinstance(product['stock_levels'], list):
                    product['stock_levels'] = [product['stock_levels']]
                elif not product.get('stock_levels'):
                    product['stock_levels'] = []
                processed_data.append(product)
            
            print(f"Products endpoint: Returning {len(processed_data)} processed products")
            return JSONResponse(content=processed_data)
        else:
            print("Products endpoint: No data returned from query")
            return JSONResponse(content=[])
            
    except Exception as e:
        print(f"Exception in products endpoint: {str(e)}")
        # Fallback to basic query if join fails
        try:
            print("Products endpoint: Trying fallback query...")
            products_data = supabase.table("products").select("*").execute()
            print(f"Fallback query returned {len(products_data.data) if products_data.data else 0} products")
            return JSONResponse(content=products_data.data or [])
        except Exception as fallback_error:
            print(f"Fallback query also failed: {str(fallback_error)}")
            return JSONResponse(content=[])

@app.post("/products")
def create_product(product: dict = Body(...), payload=Depends(require_permission("products_create"))):
    try:
        # Validate and trim input fields
        product_name = product.get("name", "").strip()
        sku_code = product.get("skuCode", "").strip()
        hsn_code = product.get("hsnCode", "").strip()
        ean_code = product.get("eanCode", "").strip()
        
        # Validation checks
        if not product_name:
            raise HTTPException(status_code=400, detail="Product name is required")
        
        if not sku_code:
            raise HTTPException(status_code=400, detail="SKU code is required")
        
        if not hsn_code:
            raise HTTPException(status_code=400, detail="HSN code is required")
        
        # Validate SKU code (alphanumeric only, no spaces)
        if not sku_code.replace(" ", "").isalnum():
            raise HTTPException(status_code=400, detail="SKU code must contain only letters and numbers, no spaces allowed")
        
        # Validate HSN code (numeric only)
        if not hsn_code.isdigit():
            raise HTTPException(status_code=400, detail="HSN code must contain only numbers")
        
        # Validate EAN code (numeric only, if provided)
        if ean_code and not ean_code.isdigit():
            raise HTTPException(status_code=400, detail="EAN code must contain only numbers")
        
        # Check for duplicates
        if check_duplicate_product_name(product_name):
            raise HTTPException(status_code=409, detail=f"A product with name '{product_name}' already exists")
        
        if check_duplicate_sku_code(sku_code):
            raise HTTPException(status_code=409, detail=f"A product with SKU code '{sku_code}' already exists")
        
        if check_duplicate_hsn_code(hsn_code):
            raise HTTPException(status_code=409, detail=f"A product with HSN code '{hsn_code}' already exists")
        
        if ean_code and check_duplicate_ean_code(ean_code):
            raise HTTPException(status_code=409, detail=f"A product with EAN code '{ean_code}' already exists")
        
        # Map camelCase to snake_case
        product_data = {
            "name": product_name,  # Use trimmed name
            "description": product.get("description"),
            "sku_code": sku_code,  # Use trimmed SKU code
            "hsn_code": hsn_code,  # Use trimmed HSN code
            "barcode": ean_code,   # Use trimmed EAN code
            "category_id": product.get("categoryId"),
            "subcategory_id": product.get("subcategoryId"),
            "unit_id": product.get("unitId"),
            "cost_price": product.get("costPrice"),
            "selling_price": product.get("retailPrice"),
            "sale_price": product.get("salePrice"),
            "mrp": product.get("mrp"),
            "minimum_stock": int(product.get("reorderLevel", 0)) if product.get("reorderLevel") is not None else 0,
            "maximum_stock": product.get("maximumStock"),
            "reorder_point": int(product.get("reorderLevel", 0)) if product.get("reorderLevel") is not None else 0,
            "is_active": product.get("isActive", True),
            "supplier_id": product.get("supplierId"),
            "sale_tax_id": product.get("saleTaxId"),
            "sale_tax_type": product.get("saleTaxType", "exclusive"),
            "purchase_tax_id": product.get("purchaseTaxId"),
            "purchase_tax_type": product.get("purchaseTaxType", "exclusive"),
            "manufacturer": product.get("manufacturer"),
            "brand": product.get("brand"),
            "manufacturer_part_number": product.get("manufacturerPartNumber"),
            "warranty_period": product.get("warrantyPeriod"),
            "warranty_unit": product.get("warrantyUnit"),
            "product_tags": product.get("productTags", []),
            "is_serialized": product.get("isSerialized", False),
            "track_inventory": product.get("trackInventory", True),
            "allow_override_price": product.get("allowOverridePrice", False),
            "discount_percentage": product.get("discountPercentage", 0),
            "warehouse_rack": product.get("warehouseRack"),
            "unit_conversions": product.get("unitConversions")
        }
        
        # Create the product
        data = supabase.table("products").insert(product_data).execute()
        created_product = data.data[0] if data.data else {}
        
        # Handle initial stock quantity
        initial_quantity = product.get("initialQty", 0)
        print(f"Create product: initial_quantity = {initial_quantity}, product_id = {created_product.get('id') if created_product else 'None'}")
        
        # Always create stock level record, even if initial_quantity is 0
        if created_product:
            try:
                # Create stock level record with proper field mapping
                stock_data = {
                    "product_id": created_product["id"],
                    "quantity_on_hand": initial_quantity or 0,
                    "quantity_reserved": 0
                    # quantity_available is a generated column, so we don't set it
                }
                print(f"Creating stock level with data: {stock_data}")
                
                # Create the stock level
                stock_result = supabase.table("stock_levels").insert(stock_data).execute()
                print(f"Stock level created successfully for product {created_product['id']}")
                
                # Create inventory transaction for audit trail only if there's initial quantity
                if stock_result.data and len(stock_result.data) > 0 and initial_quantity > 0:
                    created_stock = stock_result.data[0]
                    transaction_data = {
                        "product_id": created_stock["product_id"],
                        "transaction_type": "initial_stock",
                        "quantity_change": initial_quantity,
                        "reference_type": "product_creation",
                        "reference_id": created_product["id"],
                        "notes": f"Initial stock quantity set during product creation - Quantity: {initial_quantity}",
                        "created_by": payload.get("sub")
                    }
                    
                    try:
                        supabase.table("inventory_transactions").insert(transaction_data).execute()
                        print(f"Created inventory transaction for initial stock")
                    except Exception as transaction_error:
                        print(f"Error creating inventory transaction: {str(transaction_error)}")
                        # Don't fail if transaction creation fails
                else:
                    print(f"Stock level created for product {created_product['id']} with quantity: {initial_quantity}")
                    
            except Exception as stock_error:
                print(f"Error creating stock level: {str(stock_error)}")
                # Check if it's a unique constraint violation (stock level already exists)
                if "duplicate key value violates unique constraint" in str(stock_error) and "stock_levels_product_id_key" in str(stock_error):
                    print(f"Stock level already exists for product {created_product['id']}, skipping stock creation")
                else:
                    print(f"Unexpected error creating stock level: {str(stock_error)}")
                # Don't fail the product creation if stock creation fails
        
        return JSONResponse(content=created_product)
        
    except Exception as e:
        print(f"Error creating product: {str(e)}")
        
        # Handle unique constraint violations
        if "duplicate key value violates unique constraint" in str(e):
            if "products_sku_code_key" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="SKU Code already exists. Please use a different SKU Code."
                )
            elif "products_name_key" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Product name already exists. Please use a different product name."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A product with this information already exists."
                )
        
        # Handle UUID format errors
        elif "invalid input syntax for type uuid" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data format. Please check your input and try again."
            )
        
        # Generic error
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating product: {str(e)}"
            )

@app.put("/products/{product_id}")
def update_product(product_id: str, product: dict = Body(...), payload=Depends(require_permission("products_edit"))):
    try:
        print(f"Update product {product_id}: Received data = {product}")
        print(f"Update product {product_id}: reorderLevel value = {product.get('reorderLevel')} (type: {type(product.get('reorderLevel'))})")
        
        # Validate and trim input fields
        product_name = product.get("name", "").strip()
        sku_code = product.get("skuCode", "").strip()
        hsn_code = product.get("hsnCode", "").strip()
        ean_code = product.get("eanCode", "").strip()
        
        # Validation checks
        if not product_name:
            raise HTTPException(status_code=400, detail="Product name is required")
        
        if not sku_code:
            raise HTTPException(status_code=400, detail="SKU code is required")
        
        if not hsn_code:
            raise HTTPException(status_code=400, detail="HSN code is required")
        
        # Validate SKU code (alphanumeric only, no spaces)
        if not sku_code.replace(" ", "").isalnum():
            raise HTTPException(status_code=400, detail="SKU code must contain only letters and numbers, no spaces allowed")
        
        # Validate HSN code (numeric only)
        if not hsn_code.isdigit():
            raise HTTPException(status_code=400, detail="HSN code must contain only numbers")
        
        # Validate EAN code (numeric only, if provided)
        if ean_code and not ean_code.isdigit():
            raise HTTPException(status_code=400, detail="EAN code must contain only numbers")
        
        # Check for duplicates (excluding current product)
        if check_duplicate_product_name(product_name, product_id):
            raise HTTPException(status_code=409, detail=f"A product with name '{product_name}' already exists")
        
        if check_duplicate_sku_code(sku_code, product_id):
            raise HTTPException(status_code=409, detail=f"A product with SKU code '{sku_code}' already exists")
        
        if check_duplicate_hsn_code(hsn_code, product_id):
            raise HTTPException(status_code=409, detail=f"A product with HSN code '{hsn_code}' already exists")
        
        if ean_code and check_duplicate_ean_code(ean_code, product_id):
            raise HTTPException(status_code=409, detail=f"A product with EAN code '{ean_code}' already exists")
        
        # Map camelCase to snake_case
        product_data = {
            "name": product_name,  # Use trimmed name
            "description": product.get("description"),
            "sku_code": sku_code,  # Use trimmed SKU code
            "hsn_code": hsn_code,  # Use trimmed HSN code
            "barcode": ean_code,   # Use trimmed EAN code
            "category_id": product.get("categoryId"),
            "subcategory_id": product.get("subcategoryId"),
            "unit_id": product.get("unitId"),
            "cost_price": product.get("costPrice"),
            "selling_price": product.get("retailPrice"),
            "sale_price": product.get("salePrice"),
            "mrp": product.get("mrp"),
            "minimum_stock": int(product.get("reorderLevel", 0)) if product.get("reorderLevel") is not None else 0,
            "maximum_stock": product.get("maximumStock"),
            "reorder_point": int(product.get("reorderLevel", 0)) if product.get("reorderLevel") is not None else 0,
            "is_active": product.get("isActive", True),
            "supplier_id": product.get("supplierId"),
            "sale_tax_id": product.get("saleTaxId"),
            "sale_tax_type": product.get("saleTaxType", "exclusive"),
            "purchase_tax_id": product.get("purchaseTaxId"),
            "purchase_tax_type": product.get("purchaseTaxType", "exclusive"),
            "manufacturer": product.get("manufacturer"),
            "brand": product.get("brand"),
            "manufacturer_part_number": product.get("manufacturerPartNumber"),
            "warranty_period": product.get("warrantyPeriod"),
            "warranty_unit": product.get("warrantyUnit"),
            "product_tags": product.get("productTags", []),
            "is_serialized": product.get("isSerialized", False),
            "track_inventory": product.get("trackInventory", True),
            "allow_override_price": product.get("allowOverridePrice", False),
            "discount_percentage": product.get("discountPercentage", 0),
            "warehouse_rack": product.get("warehouseRack"),
            "unit_conversions": product.get("unitConversions")
        }
        
        print(f"Update product {product_id}: Saving data = {product_data}")
        print(f"Update product {product_id}: reorder_point being saved = {product_data.get('reorder_point')} (type: {type(product_data.get('reorder_point'))})")
        data = supabase.table("products").update(product_data).eq("id", product_id).execute()
        updated_product = data.data[0] if data.data else {}
        print(f"Update product {product_id}: Updated product = {updated_product}")
        print(f"Update product {product_id}: reorder_point in response = {updated_product.get('reorder_point')} (type: {type(updated_product.get('reorder_point'))})")
        
        # Note: Stock level updates are disabled in edit mode
        # Stock quantities should be managed through the dedicated inventory module
        # This ensures proper audit trails and prevents accidental stock modifications
        
        return JSONResponse(content=updated_product)
        
    except Exception as e:
        print(f"Error updating product: {str(e)}")
        
        # Handle unique constraint violations
        if "duplicate key value violates unique constraint" in str(e):
            if "products_sku_code_key" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="SKU Code already exists. Please use a different SKU Code."
                )
            elif "products_name_key" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Product name already exists. Please use a different product name."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A product with this information already exists."
                )
        
        # Handle UUID format errors
        elif "invalid input syntax for type uuid" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data format. Please check your input and try again."
            )
        
        # Generic error
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error updating product: {str(e)}"
            )

@app.delete("/products/{product_id}")
def delete_product(product_id: str, payload=Depends(require_permission("products_delete"))):
    try:
        data = supabase.table("products").delete().eq("id", product_id).execute()
        return JSONResponse(content={"message": "Product deleted successfully"})
    except Exception as e:
        print(f"Error deleting product: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting product: {str(e)}"
        )

@app.get("/customers")
def get_customers(payload=Depends(verify_jwt)):
    data = supabase.table("customers").select("*").execute()
    customers = [to_camel_case_customer(customer) for customer in data.data]
    return JSONResponse(content=customers)

@app.post("/customers")
def create_customer(customer: dict = Body(...), payload=Depends(require_permission("customers_create"))):
    try:
        # Check for duplicate customer name
        customer_name = customer.get("name", "").strip()
        if not customer_name:
            raise HTTPException(status_code=400, detail="Customer name is required")
        
        if check_duplicate_customer_name(customer_name):
            raise HTTPException(status_code=409, detail=f"A customer with name '{customer_name}' already exists")
        
        # Map camelCase to snake_case
        customer_data = {
            "name": customer_name,  # Use trimmed name
            "email": customer.get("email"),
            "phone": customer.get("phone"),
            "billing_address": customer.get("billingAddress"),
            "shipping_address": customer.get("shippingAddress"),
            "tax_id": customer.get("taxId"),
            "notes": customer.get("notes"),
            "credit_limit": customer.get("creditLimit", 0),
            "current_credit": customer.get("currentCredit", 0),
            "customer_type": customer.get("customerType", "retail"),
            "is_active": customer.get("isActive", True)
        }
        data = supabase.table("customers").insert(customer_data).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating customer: {str(e)}"
        )

@app.put("/customers/{customer_id}")
def update_customer(customer_id: str, customer: dict = Body(...), payload=Depends(require_permission("customers_edit"))):
    try:
        # Check for duplicate customer name
        customer_name = customer.get("name", "").strip()
        if customer_name and check_duplicate_customer_name(customer_name, customer_id):
            raise HTTPException(status_code=409, detail=f"A customer with name '{customer_name}' already exists")
        
        # Map camelCase to snake_case
        customer_data = {
            "name": customer_name,  # Use trimmed name
            "email": customer.get("email"),
            "phone": customer.get("phone"),
            "billing_address": customer.get("billingAddress"),
            "shipping_address": customer.get("shippingAddress"),
            "tax_id": customer.get("taxId"),
            "notes": customer.get("notes"),
            "credit_limit": customer.get("creditLimit", 0),
            "current_credit": customer.get("currentCredit", 0),
            "customer_type": customer.get("customerType", "retail"),
            "is_active": customer.get("isActive", True)
        }
        data = supabase.table("customers").update(customer_data).eq("id", customer_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating customer: {str(e)}"
        )

@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: str, payload=Depends(require_permission("customers_delete"))):
    data = supabase.table("customers").delete().eq("id", customer_id).execute()
    return JSONResponse(content=data.data)

@app.get("/suppliers")
def get_suppliers(payload=Depends(verify_jwt)):
    data = supabase.table("suppliers").select("*").execute()
    suppliers = [to_camel_case_supplier(supplier) for supplier in data.data]
    return JSONResponse(content=suppliers)

@app.post("/suppliers")
def create_supplier(supplier: dict = Body(...), payload=Depends(require_permission("suppliers_create"))):
    try:
        # Check for duplicate supplier name
        supplier_name = supplier.get("name", "").strip()
        if not supplier_name:
            raise HTTPException(status_code=400, detail="Supplier name is required")
        
        if check_duplicate_supplier_name(supplier_name):
            raise HTTPException(status_code=409, detail=f"A supplier with name '{supplier_name}' already exists")
        
        # Map camelCase to snake_case
        supplier_data = {
            "name": supplier_name,  # Use trimmed name
            "contact_name": supplier["contactName"],
            "email": supplier.get("email"),
            "phone": supplier.get("phone"),
            "billing_address": supplier.get("billingAddress"),
            "shipping_address": supplier.get("shippingAddress"),
            "payment_terms": supplier.get("paymentTerms"),
            "tax_id": supplier.get("taxId"),
            "notes": supplier.get("notes"),
            "is_active": supplier.get("isActive", True)
        }
        data = supabase.table("suppliers").insert(supplier_data).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating supplier: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating supplier: {str(e)}"
        )

@app.put("/suppliers/{supplier_id}")
def update_supplier(supplier_id: str, supplier: dict = Body(...), payload=Depends(require_permission("suppliers_edit"))):
    try:
        # Check for duplicate supplier name
        supplier_name = supplier.get("name", "").strip()
        if supplier_name and check_duplicate_supplier_name(supplier_name, supplier_id):
            raise HTTPException(status_code=409, detail=f"A supplier with name '{supplier_name}' already exists")
        
        # Map camelCase to snake_case
        supplier_data = {
            "name": supplier_name,  # Use trimmed name
            "contact_name": supplier["contactName"],
            "email": supplier.get("email"),
            "phone": supplier.get("phone"),
            "billing_address": supplier.get("billingAddress"),
            "shipping_address": supplier.get("shippingAddress"),
            "payment_terms": supplier.get("paymentTerms"),
            "tax_id": supplier.get("taxId"),
            "notes": supplier.get("notes"),
            "is_active": supplier.get("isActive", True)
        }
        data = supabase.table("suppliers").update(supplier_data).eq("id", supplier_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating supplier: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating supplier: {str(e)}"
        )

@app.delete("/suppliers/{supplier_id}")
def delete_supplier(supplier_id: str, payload=Depends(require_permission("suppliers_delete"))):
    data = supabase.table("suppliers").delete().eq("id", supplier_id).execute()
    return JSONResponse(content=data.data)

@app.get("/taxes")
def get_taxes(payload=Depends(verify_jwt)):
    data = supabase.table("taxes").select("*").execute()
    taxes = [to_camel_case_tax(tax) for tax in data.data]
    return JSONResponse(content=taxes)

@app.post("/taxes")
def create_tax(tax: dict = Body(...), payload=Depends(require_permission("taxes_create"))):
    try:
        # Check for duplicate tax name
        tax_name = tax.get("name", "").strip()
        if not tax_name:
            raise HTTPException(status_code=400, detail="Tax name is required")
        
        if check_duplicate_tax_name(tax_name):
            raise HTTPException(status_code=409, detail=f"A tax with name '{tax_name}' already exists")
        
        # Convert percentage to decimal (e.g., 5 -> 0.05)
        rate_percentage = float(tax["rate"])
        rate_decimal = rate_percentage / 100.0
        
        # Map camelCase to snake_case
        tax_data = {
            "name": tax_name,  # Use trimmed name
            "rate": rate_decimal,
            "is_default": False,  # Always false since we removed the default feature
            "applied_to": tax.get("appliedTo", "products"),
            "description": tax.get("description"),
            "is_active": tax.get("isActive", True)
        }
        data = supabase.table("taxes").insert(tax_data).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating tax: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating tax: {str(e)}"
        )

@app.put("/taxes/{tax_id}")
def update_tax(tax_id: str, tax: dict = Body(...), payload=Depends(require_permission("taxes_edit"))):
    try:
        # Check for duplicate tax name
        tax_name = tax.get("name", "").strip()
        if tax_name and check_duplicate_tax_name(tax_name, tax_id):
            raise HTTPException(status_code=409, detail=f"A tax with name '{tax_name}' already exists")
        
        # Convert percentage to decimal (e.g., 5 -> 0.05)
        rate_percentage = float(tax["rate"])
        rate_decimal = rate_percentage / 100.0
        
        # Map camelCase to snake_case
        tax_data = {
            "name": tax_name,  # Use trimmed name
            "rate": rate_decimal,
            "is_default": False,  # Always false since we removed the default feature
            "applied_to": tax.get("appliedTo", "products"),
            "description": tax.get("description"),
            "is_active": tax.get("isActive", True)
        }
        data = supabase.table("taxes").update(tax_data).eq("id", tax_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating tax: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating tax: {str(e)}"
        )

@app.delete("/taxes/{tax_id}")
def delete_tax(tax_id: str, payload=Depends(require_permission("taxes_delete"))):
    data = supabase.table("taxes").delete().eq("id", tax_id).execute()
    return JSONResponse(content=data.data)

@app.get("/units")
def get_units(payload=Depends(verify_jwt)):
    data = supabase.table("units").select("*").execute()
    units = [to_camel_case_unit(unit) for unit in data.data]
    return JSONResponse(content=units)

@app.post("/units")
def create_unit(unit: dict = Body(...), payload=Depends(require_permission("units_create"))):
    try:
        # Check for duplicate unit name
        unit_name = unit.get("name", "").strip()
        if not unit_name:
            raise HTTPException(status_code=400, detail="Unit name is required")
        
        if check_duplicate_unit_name(unit_name):
            raise HTTPException(status_code=409, detail=f"A unit with name '{unit_name}' already exists")
        
        # Map camelCase to snake_case
        unit_data = {
            "name": unit_name,  # Use trimmed name
            "abbreviation": unit["abbreviation"],
            "description": unit.get("description"),
            "is_active": unit.get("isActive", True)
        }
        data = supabase.table("units").insert(unit_data).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating unit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating unit: {str(e)}"
        )

@app.put("/units/{unit_id}")
def update_unit(unit_id: str, unit: dict = Body(...), payload=Depends(require_permission("units_edit"))):
    try:
        # Check for duplicate unit name
        unit_name = unit.get("name", "").strip()
        if unit_name and check_duplicate_unit_name(unit_name, unit_id):
            raise HTTPException(status_code=409, detail=f"A unit with name '{unit_name}' already exists")
        
        # Map camelCase to snake_case
        unit_data = {
            "name": unit_name,  # Use trimmed name
            "abbreviation": unit["abbreviation"],
            "description": unit.get("description"),
            "is_active": unit.get("isActive", True)
        }
        data = supabase.table("units").update(unit_data).eq("id", unit_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating unit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating unit: {str(e)}"
        )

@app.delete("/units/{unit_id}")
def delete_unit(unit_id: str, payload=Depends(require_permission("units_delete"))):
    data = supabase.table("units").delete().eq("id", unit_id).execute()
    return JSONResponse(content=data.data)

@app.get("/inventory")
def get_inventory(payload=Depends(require_permission("inventory_view"))):
    data = supabase.table("inventory").select("*").execute()
    return JSONResponse(content=data.data)

# Stock Levels endpoints
@app.get("/inventory/stock-levels")
def get_stock_levels(payload=Depends(require_permission("inventory_stock_view"))):
    # Join with products and locations to get product and location names
    data = supabase.table("stock_levels").select(
        "*, products(name, sku_code), locations(name)"
    ).execute()
    
    stock_levels = []
    for level in data.data:
        # Extract product and location info from the joined data
        product = level.get("products", {})
        location = level.get("locations", {})
        
        stock_level = {
            "id": level.get("id"),
            "productId": level.get("product_id"),
            "productName": product.get("name") if product else None,
            "skuCode": product.get("sku_code") if product else None,
            "locationId": level.get("location_id"),
            "locationName": location.get("name") if location else None,
            "quantity": int(level.get("quantity_on_hand", 0)) if level.get("quantity_on_hand") is not None else 0,
            "quantityReserved": int(level.get("quantity_reserved", 0)) if level.get("quantity_reserved") is not None else 0,
            "quantityAvailable": int(level.get("quantity_available", 0)) if level.get("quantity_available") is not None else 0,
            "minStockLevel": 0,  # Not in schema, default to 0
            "maxStockLevel": 0,  # Not in schema, default to 0
            "reorderPoint": 0,   # Not in schema, default to 0
            "lastUpdated": level.get("last_updated")
        }
        stock_levels.append(stock_level)
    
    return JSONResponse(content=stock_levels)

@app.post("/inventory/stock-levels")
def create_stock_level(stock_level: dict = Body(...), payload=Depends(require_permission("inventory_stock_manage"))):
    # Map camelCase to snake_case for the actual database schema
    mapped_data = {}
    if "productId" in stock_level:
        mapped_data["product_id"] = stock_level["productId"]
    if "locationId" in stock_level:
        mapped_data["location_id"] = stock_level["locationId"]
    if "quantity" in stock_level:
        mapped_data["quantity_on_hand"] = stock_level["quantity"]
    
    # Create the stock level
    data = supabase.table("stock_levels").insert(mapped_data).execute()
    
    # Create an inventory transaction for audit trail
    if data.data and len(data.data) > 0:
        created_stock_level = data.data[0]
        transaction_data = {
            "product_id": created_stock_level["product_id"],
            "transaction_type": "adjustment",
            "quantity_change": created_stock_level["quantity_on_hand"],
            "reference_type": "stock_level_creation",
            "reference_id": created_stock_level["id"],
            "notes": f"Initial stock level creation - Quantity: {created_stock_level['quantity_on_hand']}",
            "created_by": payload.get("sub")
        }
        
        try:
            supabase.table("inventory_transactions").insert(transaction_data).execute()
        except Exception as e:
            # Log the error but don't fail the stock level creation
            print(f"Failed to create inventory transaction: {e}")
    
    return JSONResponse(content=data.data)

@app.put("/inventory/stock-levels/{stock_level_id}")
def update_stock_level(stock_level_id: str, stock_level: dict = Body(...), payload=Depends(require_permission("inventory_stock_manage"))):
    data = supabase.table("stock_levels").update(stock_level).eq("id", stock_level_id).execute()
    return JSONResponse(content=data.data)

@app.delete("/inventory/stock-levels/{stock_level_id}")
def delete_stock_level(stock_level_id: str, payload=Depends(require_permission("inventory_stock_manage"))):
    data = supabase.table("stock_levels").delete().eq("id", stock_level_id).execute()
    return JSONResponse(content=data.data)

# Inventory Movements endpoints
@app.get("/inventory/movements")
def get_inventory_movements(payload=Depends(require_permission("inventory_movements_view"))):
    # Join with products to get product names and SKU codes
    data = supabase.table("inventory_movements").select(
        "*, products(name, sku_code)"
    ).execute()
    
    movements = []
    for movement in data.data:
        # Extract product info from the joined data
        product = movement.get("products", {})
        
        movement_data = {
            "id": movement.get("id"),
            "productId": movement.get("product_id"),
            "productName": product.get("name") if product else None,
            "skuCode": product.get("sku_code") if product else None,
            "type": movement.get("type"),
            "quantity": int(movement.get("quantity", 0)) if movement.get("quantity") is not None else 0,
            "previousStock": int(movement.get("previous_stock", 0)) if movement.get("previous_stock") is not None else 0,
            "newStock": int(movement.get("new_stock", 0)) if movement.get("new_stock") is not None else 0,
            "reference": movement.get("reference"),
            "notes": movement.get("notes"),
            "createdBy": movement.get("created_by"),
            "createdAt": movement.get("created_at")
        }
        movements.append(movement_data)
    
    return JSONResponse(content=movements)

@app.post("/inventory/movements")
def create_inventory_movement(movement: dict = Body(...), payload=Depends(require_permission("inventory_movements_create"))):
    # Create the movement
    data = supabase.table("inventory_movements").insert(movement).execute()
    
    # Create an inventory transaction for audit trail
    if data.data and len(data.data) > 0:
        created_movement = data.data[0]
        transaction_data = {
            "product_id": created_movement["product_id"],
            "transaction_type": created_movement["type"],
            "quantity_change": created_movement["quantity"],
            "reference_type": "inventory_movement",
            "reference_id": created_movement["id"],
            "notes": created_movement.get("notes", f"Manual inventory movement - {created_movement['type']}"),
            "created_by": payload.get("sub")
        }
        
        try:
            supabase.table("inventory_transactions").insert(transaction_data).execute()
        except Exception as e:
            # Log the error but don't fail the movement creation
            print(f"Failed to create inventory transaction: {e}")
    
    return JSONResponse(content=data.data)

# Inventory Transactions endpoints (Automatic audit trail)
@app.get("/inventory/transactions")
def get_inventory_transactions(payload=Depends(require_permission("inventory_movements_view"))):
    # Join with products to get product names and SKU codes
    data = supabase.table("inventory_transactions").select(
        "*, products(name, sku_code)"
    ).execute()
    
    transactions = []
    for transaction in data.data:
        # Extract product info from the joined data
        product = transaction.get("products", {})
        
        transaction_data = {
            "id": transaction.get("id"),
            "productId": transaction.get("product_id"),
            "productName": product.get("name") if product else None,
            "skuCode": product.get("sku_code") if product else None,
            "transactionType": transaction.get("transaction_type"),
            "quantityChange": int(transaction.get("quantity_change", 0)) if transaction.get("quantity_change") is not None else 0,
            "referenceType": transaction.get("reference_type"),
            "referenceId": transaction.get("reference_id"),
            "notes": transaction.get("notes"),
            "createdBy": transaction.get("created_by"),
            "createdAt": transaction.get("created_at")
        }
        transactions.append(transaction_data)
    
    return JSONResponse(content=transactions)

@app.post("/inventory/transactions")
def create_inventory_transaction(transaction: dict = Body(...), payload=Depends(require_permission("inventory_movements_create"))):
    # Map camelCase to snake_case
    mapped_data = {}
    if "productId" in transaction:
        mapped_data["product_id"] = transaction["productId"]
    if "transactionType" in transaction:
        mapped_data["transaction_type"] = transaction["transactionType"]
    if "quantityChange" in transaction:
        mapped_data["quantity_change"] = transaction["quantityChange"]
    if "referenceType" in transaction:
        mapped_data["reference_type"] = transaction["referenceType"]
    if "referenceId" in transaction:
        mapped_data["reference_id"] = transaction["referenceId"]
    if "notes" in transaction:
        mapped_data["notes"] = transaction["notes"]
    if "createdBy" in transaction:
        mapped_data["created_by"] = transaction["createdBy"]
    else:
        mapped_data["created_by"] = payload.get("sub")  # Use current user ID
    
    data = supabase.table("inventory_transactions").insert(mapped_data).execute()
    return JSONResponse(content=data.data)

# Locations endpoints
@app.get("/inventory/locations")
def get_locations(payload=Depends(require_permission("inventory_locations_view"))):
    data = supabase.table("locations").select("*").execute()
    locations = [to_camel_case_location(location) for location in data.data]
    return JSONResponse(content=locations)

@app.post("/inventory/locations")
def create_location(location: dict = Body(...), payload=Depends(require_permission("inventory_locations_manage"))):
    data = supabase.table("locations").insert(location).execute()
    return JSONResponse(content=data.data)

@app.put("/inventory/locations/{location_id}")
def update_location(location_id: str, location: dict = Body(...), payload=Depends(require_permission("inventory_locations_manage"))):
    data = supabase.table("locations").update(location).eq("id", location_id).execute()
    return JSONResponse(content=data.data)

@app.delete("/inventory/locations/{location_id}")
def delete_location(location_id: str, payload=Depends(require_permission("inventory_locations_manage"))):
    data = supabase.table("locations").delete().eq("id", location_id).execute()
    return JSONResponse(content=data.data)

@app.get("/categories")
def get_categories(payload=Depends(verify_jwt)):
    data = supabase.table("categories").select("*").execute()
    categories = [to_camel_case_category(category) for category in data.data]
    return JSONResponse(content=categories)

@app.post("/categories")
def create_category(category: dict = Body(...), payload=Depends(verify_jwt)):
    try:
        # Check for duplicate category name with same parent
        category_name = category.get("name", "").strip()
        parent_id = category.get("parentId")
        if not category_name:
            raise HTTPException(status_code=400, detail="Category name is required")
        
        # Convert parentId to parent_id for checking
        parent_id_for_check = None
        if parent_id and parent_id != "none":
            parent_id_for_check = parent_id
        
        if check_duplicate_category_name(category_name, parent_id_for_check):
            parent_text = f" under parent '{parent_id}'" if parent_id_for_check else " (root category)"
            raise HTTPException(status_code=409, detail=f"A category with name '{category_name}'{parent_text} already exists")
        
        # Map camelCase to snake_case
        if "isActive" in category:
            category["is_active"] = category.pop("isActive")
        if "parentId" in category:
            value = category.pop("parentId")
            if not value or value == "none":
                category["parent_id"] = None
            else:
                category["parent_id"] = value
        if "createdAt" in category:
            category["created_at"] = category.pop("createdAt")
        if "updatedAt" in category:
            category["updated_at"] = category.pop("updatedAt")
        
        # Use trimmed name
        category["name"] = category_name
        
        data = supabase.table("categories").insert(category).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating category: {str(e)}"
        )

@app.put("/categories/{category_id}")
def update_category(category_id: str, category: dict = Body(...), payload=Depends(verify_jwt)):
    try:
        # Check for duplicate category name with same parent
        category_name = category.get("name", "").strip()
        parent_id = category.get("parentId")
        if category_name:
            # Convert parentId to parent_id for checking
            parent_id_for_check = None
            if parent_id and parent_id != "none":
                parent_id_for_check = parent_id
            
            if check_duplicate_category_name(category_name, parent_id_for_check, category_id):
                parent_text = f" under parent '{parent_id}'" if parent_id_for_check else " (root category)"
                raise HTTPException(status_code=409, detail=f"A category with name '{category_name}'{parent_text} already exists")
        
        # Map camelCase to snake_case
        if "isActive" in category:
            category["is_active"] = category.pop("isActive")
        if "parentId" in category:
            value = category.pop("parentId")
            if not value or value == "none":
                category["parent_id"] = None
            else:
                category["parent_id"] = value
        if "createdAt" in category:
            category["created_at"] = category.pop("createdAt")
        if "updatedAt" in category:
            category["updated_at"] = category.pop("updatedAt")
        
        # Use trimmed name
        category["name"] = category_name
        
        data = supabase.table("categories").update(category).eq("id", category_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating category: {str(e)}"
        )

@app.delete("/categories/{category_id}")
def delete_category(category_id: str, payload=Depends(require_role(['admin']))):
    data = supabase.table("categories").delete().eq("id", category_id).execute()
    return JSONResponse(content=data.data)

# --- Roles Endpoints ---
@app.get("/roles")
def get_roles(payload=Depends(require_role(["admin"]))):
    data = supabase.table("roles").select("*").execute()
    roles = [to_camel_case_role(role) for role in data.data]
    return JSONResponse(content=roles)

# Helper function to check for duplicate role names
def check_duplicate_role_name(name: str, exclude_role_name: str = None):
    """Check if a role with the given name already exists"""
    try:
        query = supabase.table("roles").select("name").eq("name", name)
        if exclude_role_name:
            query = query.neq("name", exclude_role_name)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate category names with same parent
def check_duplicate_category_name(name: str, parent_id: str = None, exclude_category_id: str = None):
    """Check if a category with the given name and parent already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_name = name.strip() if name else ""
        query = supabase.table("categories").select("id").eq("name", trimmed_name)
        if parent_id:
            query = query.eq("parent_id", parent_id)
        else:
            query = query.is_("parent_id", "null")
        if exclude_category_id:
            query = query.neq("id", exclude_category_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate unit names
def check_duplicate_unit_name(name: str, exclude_unit_id: str = None):
    """Check if a unit with the given name already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_name = name.strip() if name else ""
        query = supabase.table("units").select("id").eq("name", trimmed_name)
        if exclude_unit_id:
            query = query.neq("id", exclude_unit_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate tax names
def check_duplicate_tax_name(name: str, exclude_tax_id: str = None):
    """Check if a tax with the given name already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_name = name.strip() if name else ""
        query = supabase.table("taxes").select("id").eq("name", trimmed_name)
        if exclude_tax_id:
            query = query.neq("id", exclude_tax_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate supplier names
def check_duplicate_supplier_name(name: str, exclude_supplier_id: str = None):
    """Check if a supplier with the given name already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_name = name.strip() if name else ""
        query = supabase.table("suppliers").select("id").eq("name", trimmed_name)
        if exclude_supplier_id:
            query = query.neq("id", exclude_supplier_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate customer names
def check_duplicate_customer_name(name: str, exclude_customer_id: str = None):
    """Check if a customer with the given name already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_name = name.strip() if name else ""
        query = supabase.table("customers").select("id").eq("name", trimmed_name)
        if exclude_customer_id:
            query = query.neq("id", exclude_customer_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate product names
def check_duplicate_product_name(name: str, exclude_product_id: str = None):
    """Check if a product with the given name already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_name = name.strip() if name else ""
        query = supabase.table("products").select("id").eq("name", trimmed_name)
        if exclude_product_id:
            query = query.neq("id", exclude_product_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate SKU codes
def check_duplicate_sku_code(sku_code: str, exclude_product_id: str = None):
    """Check if a product with the given SKU code already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_sku = sku_code.strip() if sku_code else ""
        query = supabase.table("products").select("id").eq("sku_code", trimmed_sku)
        if exclude_product_id:
            query = query.neq("id", exclude_product_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate HSN codes
def check_duplicate_hsn_code(hsn_code: str, exclude_product_id: str = None):
    """Check if a product with the given HSN code already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_hsn = hsn_code.strip() if hsn_code else ""
        query = supabase.table("products").select("id").eq("hsn_code", trimmed_hsn)
        if exclude_product_id:
            query = query.neq("id", exclude_product_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate EAN codes
def check_duplicate_ean_code(ean_code: str, exclude_product_id: str = None):
    """Check if a product with the given EAN code already exists"""
    try:
        # Trim leading and trailing spaces
        trimmed_ean = ean_code.strip() if ean_code else ""
        query = supabase.table("products").select("id").eq("barcode", trimmed_ean)
        if exclude_product_id:
            query = query.neq("id", exclude_product_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

@app.post("/roles")
def create_role(role: dict = Body(...), payload=Depends(require_role(["admin"]))):
    # Check for duplicate role name
    role_name = role.get("name")
    if not role_name:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    if check_duplicate_role_name(role_name):
        raise HTTPException(status_code=409, detail=f"A role with name '{role_name}' already exists")
    
    # Map camelCase to snake_case
    if "createdAt" in role:
        role["created_at"] = role.pop("createdAt")
    if "updatedAt" in role:
        role["updated_at"] = role.pop("updatedAt")
    
    # Store permissions directly
    if "permissions" in role and isinstance(role["permissions"], list):
        role["permissions"] = role["permissions"]
    else:
        role["permissions"] = []
    
    data = supabase.table("roles").insert(role).execute()
    return JSONResponse(content=data.data)

@app.put("/roles/{role_name}")
def update_role(role_name: str, role: dict = Body(...), payload=Depends(require_role(["admin"]))):
    # Check for duplicate role name if name is being changed
    new_role_name = role.get("name")
    if new_role_name and new_role_name != role_name:
        if check_duplicate_role_name(new_role_name, role_name):
            raise HTTPException(status_code=409, detail=f"A role with name '{new_role_name}' already exists")
    
    # Map camelCase to snake_case for timestamp fields
    if "createdAt" in role:
        role["created_at"] = role.pop("createdAt")
    if "updatedAt" in role:
        role["updated_at"] = role.pop("updatedAt")
    
    # Store permissions directly
    if "permissions" in role and isinstance(role["permissions"], list):
        role["permissions"] = role["permissions"]
    else:
        role["permissions"] = []
    
    # Remove id field if present (shouldn't be updated)
    role.pop("id", None)
    
    # For updates, we typically don't want to change created_at, 
    # but we can allow updated_at to be set (though the trigger will handle it)
    if "created_at" in role:
        # Only allow created_at to be set if it's not already set in the database
        existing_role = supabase.table("roles").select("created_at").eq("name", role_name).execute()
        if existing_role.data and existing_role.data[0].get("created_at"):
            role.pop("created_at")  # Don't update existing created_at
    
    data = supabase.table("roles").update(role).eq("name", role_name).execute()
    return JSONResponse(content=data.data)

@app.delete("/roles/{role_name}")
def delete_role(role_name: str, payload=Depends(require_role(["admin"]))):
    data = supabase.table("roles").delete().eq("name", role_name).execute()
    return JSONResponse(content=data.data)

# --- Users Endpoints ---
@app.get("/users")
def get_users(payload=Depends(require_role(["admin"]))):
    try:
        # Get profiles data with role_id
        profiles_data = supabase.table("profiles").select("id, username, full_name, is_active, role_id, created_at, updated_at").execute()
    except Exception as e:
        print(f"Error fetching profiles: {str(e)}")
        return JSONResponse(content=[])
    
    users = []
    
    for profile in profiles_data.data:
        # Get role name from roles table using role_id
        role_name = "staff"  # default fallback
        if profile.get("role_id"):
            try:
                role_data = supabase.table("roles").select("name").eq("id", profile["role_id"]).execute()
                if role_data.data and len(role_data.data) > 0:
                    role_name = role_data.data[0].get("name", "staff")
            except Exception as e:
                print(f"Error fetching role for user {profile.get('id')}: {str(e)}")
                role_name = "staff"
        
        # Try to get auth user data, but don't fail if it doesn't exist
        auth_user = {}
        try:
            auth_resp = requests.get(
                f"{SUPABASE_URL}/auth/v1/admin/users/{profile['id']}",
                headers={
                    "apiKey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                }
            )
            if auth_resp.status_code == 200:
                auth_user = auth_resp.json()
        except Exception:
            # User might not exist in auth.users (created directly in profiles)
            pass
        
        # Combine profile and auth data
        combined_user = {
            "id": profile.get("id"),
            "name": profile.get("full_name") or "No Name",  # Use full_name since 'name' column doesn't exist
            "email": auth_user.get("email") or f"{profile.get('username', 'user')}@example.com",  # Fallback email
            "role": role_name,
            "status": "Active" if profile.get("is_active", True) else "Inactive",
            "lastLogin": auth_user.get("last_sign_in_at"),
            "createdAt": profile.get("created_at"),
            "updatedAt": profile.get("updated_at"),
        }
        users.append(combined_user)
    
    return JSONResponse(content=users)

# Helper function to check for duplicate user names
def check_duplicate_user_name(name: str, exclude_user_id: str = None):
    """Check if a user with the given name already exists"""
    try:
        query = supabase.table("profiles").select("id").eq("full_name", name)
        if exclude_user_id:
            query = query.neq("id", exclude_user_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        return False

# Helper function to check for duplicate user emails
def check_duplicate_user_email(email: str, exclude_user_id: str = None):
    """Check if a user with the given email already exists"""
    try:
        # First check if email column exists in profiles table
        # If not, we'll check auth.users instead
        query = supabase.table("profiles").select("id").eq("email", email)
        if exclude_user_id:
            query = query.neq("id", exclude_user_id)
        result = query.execute()
        return len(result.data) > 0
    except Exception:
        # If profiles table doesn't have email column, try checking auth.users
        try:
            # This is a fallback - check if user exists in auth
            resp = requests.get(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apiKey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                params={"email": email}
            )
            if resp.status_code == 200:
                users = resp.json()
                # Filter out the current user if we're updating
                if exclude_user_id:
                    users = [u for u in users if u.get("id") != exclude_user_id]
                return len(users) > 0
            return False
        except Exception:
            return False

@app.post("/users")
def create_user(user: dict = Body(...), payload=Depends(require_role(["admin"]))):
    try:
        email = user.get("email")
        password = user.get("password") or "TempPassword123!"
        name = user.get("name")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        
        # Check if user with same email already exists
        if check_duplicate_user_email(email):
            raise HTTPException(status_code=409, detail=f"A user with email '{email}' already exists")
        
        # Check if user with same name already exists
        if check_duplicate_user_name(name):
            raise HTTPException(status_code=409, detail=f"A user with name '{name}' already exists")
        
        # Use the same approach as frontend signup - this will trigger the database trigger
        # to automatically create the profile
        try:
            # Use the anon key for signup (like frontend does)
            from supabase import create_client
            anon_supabase = create_client(SUPABASE_URL, os.getenv("SUPABASE_ANON_KEY"))
            
            # Prepare user metadata (this will be used by the database trigger)
            user_metadata = {
                "username": email.split("@")[0],
                "full_name": name,
                "role": user.get("role") or "staff"
            }
            
            # Sign up the user (this will trigger the database trigger)
            auth_response = anon_supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": user_metadata
                }
            })
            
            if auth_response.user:
                user_id = auth_response.user.id
                
                # The database trigger should have created the profile automatically
                # Let's verify by fetching the profile
                try:
                    profile_data = supabase.table("profiles").select("*").eq("id", user_id).execute()
                    if profile_data.data:
                        profile = profile_data.data[0]
                        
                        # Update the profile with the correct role if needed
                        if user.get("role"):
                            try:
                                # Update profile with role directly
                                supabase.table("profiles").update({"role": user.get("role")}).eq("id", user_id).execute()
                            except Exception as e:
                                print(f"Error updating role: {str(e)}")  # Debug log
                        
                        # Update the profile with status if provided
                        if user.get("status"):
                            try:
                                is_active = (user.get("status") == "Active")
                                supabase.table("profiles").update({"is_active": is_active}).eq("id", user_id).execute()
                            except Exception as e:
                                print(f"Error updating status: {str(e)}")  # Debug log
                        
                        # Return user data
                        user_data = {
                            "id": user_id,
                            "name": profile.get("full_name"),
                            "email": email,
                            "role": user.get("role"),
                            "status": user.get("status") or "Active",
                            "createdAt": profile.get("created_at"),
                            "updatedAt": profile.get("updated_at"),
                        }
                        
                        return JSONResponse(content=user_data)
                    else:
                        raise HTTPException(status_code=500, detail="Profile was not created automatically")
                        
                except Exception as profile_error:
                    raise HTTPException(status_code=500, detail=f"Error fetching created profile: {str(profile_error)}")
            else:
                raise HTTPException(status_code=500, detail="Failed to create user in Supabase Auth")
                
        except Exception as auth_error:
            raise HTTPException(status_code=500, detail=f"Failed to create user: {str(auth_error)}")
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error creating new user: {str(e)}")

@app.put("/users/{user_id}")
def update_user(user_id: str, user: dict = Body(...), payload=Depends(require_role(["admin"]))):
    # Remove fields that are not in profiles table
    user_data = user.copy()
    user_data.pop("email", None)  # Remove email if present
    user_data.pop("lastLogin", None)  # Remove lastLogin if present
    user_data.pop("password", None)  # Remove password if present - handled by Supabase Auth
    
    # Check for duplicate name if name is being updated
    if "name" in user_data:
        new_name = user_data["name"]
        if check_duplicate_user_name(new_name, user_id):
            raise HTTPException(status_code=409, detail=f"A user with name '{new_name}' already exists")
    
    # Map status to is_active
    if "status" in user_data:
        status = user_data.pop("status")
        user_data["is_active"] = (status == "Active")
    
    # Map role name to role (no need to convert since we use role directly)
    if "role" in user_data:
        # Keep the role as is, just ensure it's a valid enum value
        role_name = user_data["role"]
        if role_name not in ["admin", "manager", "staff"]:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role_name}")
    
    # Map camelCase to snake_case
    if "roleId" in user_data:
        user_data["role"] = user_data.pop("roleId")
    if "createdAt" in user_data:
        user_data["created_at"] = user_data.pop("createdAt")
    if "updatedAt" in user_data:
        user_data["updated_at"] = user_data.pop("updatedAt")
    
    # Update name field to full_name if present
    if "name" in user_data:
        user_data["full_name"] = user_data.pop("name")
    
    data = supabase.table("profiles").update(user_data).eq("id", user_id).execute()
    return JSONResponse(content=data.data)

@app.delete("/users/{user_id}")
def delete_user(user_id: str, payload=Depends(require_role(["admin"]))):
    # First delete from profiles table
    data = supabase.table("profiles").delete().eq("id", user_id).execute()
    
    # Then delete from auth.users (optional - you might want to keep auth user for audit)
    try:
        resp = requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "apiKey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json"
            }
        )
        # Don't raise error if auth user deletion fails
    except Exception:
        pass
    
    return JSONResponse(content=data.data)

@app.get("/users/{user_id}/status")
def check_user_status(user_id: str, payload=Depends(verify_jwt)):
    """Check if a user is active"""
    try:
        profile_data = supabase.table("profiles").select("is_active").eq("id", user_id).execute()
        if profile_data.data:
            return JSONResponse(content={"is_active": profile_data.data[0].get("is_active", True)})
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking user status: {str(e)}")

@app.get("/debug/profiles-schema")
def get_profiles_schema(payload=Depends(require_role(["admin"]))):
    try:
        # Try to get all columns from profiles table
        profiles_data = supabase.table("profiles").select("*").limit(1).execute()
        
        # Get column names from the first row
        if profiles_data.data and len(profiles_data.data) > 0:
            columns = list(profiles_data.data[0].keys())
            return JSONResponse(content={
                "columns": columns,
                "sample_data": profiles_data.data[0]
            })
        else:
            return JSONResponse(content={
                "columns": [],
                "message": "No data found in profiles table"
            })
    except Exception as e:
        return JSONResponse(content={
            "error": str(e),
            "message": "Failed to get profiles schema"
        })

@app.get("/debug/products")
def debug_products():
    try:
        # Check if products table exists and has data
        data = supabase.table("products").select("count").execute()
        
        # Test products with stock_levels
        products_with_stock = supabase.table("products").select("""
            *,
            stock_levels(quantity_on_hand, quantity_available)
        """).limit(1).execute()
        
        return {
            "message": "Products table accessible",
            "count": data.count if hasattr(data, 'count') else "Unknown",
            "data": data.data if hasattr(data, 'data') else [],
            "products_with_stock": products_with_stock.data[0] if products_with_stock.data else None,
            "stock_levels_test": "Stock levels query executed successfully"
        }
    except Exception as e:
        return {
            "error": str(e),
            "message": "Failed to access products table"
        }

@app.get("/debug/stock-levels")
def debug_stock_levels():
    try:
        # Test direct access to stock_levels table
        data = supabase.table("stock_levels").select("id, product_id, quantity_on_hand, quantity_reserved, quantity_available").limit(5).execute()
        return {
            "message": "Stock levels table accessible",
            "count": data.count if hasattr(data, 'count') else "Unknown",
            "sample_data": data.data if data.data else []
        }
    except Exception as e:
        return {
            "error": str(e),
            "message": "Failed to access stock_levels table"
        }



@app.get("/config/supabase")
def get_supabase_config():
    return {
        "url": SUPABASE_URL,
        "publishable_key": os.getenv("SUPABASE_ANON_KEY")
    }

# Credit Notes endpoints
@app.get("/credit-notes")
def get_credit_notes(payload=Depends(require_permission("credit_notes_view"))):
    data = supabase.table("credit_notes").select("*").execute()
    credit_notes = [to_camel_case_credit_note(note) for note in data.data]
    return JSONResponse(content=credit_notes)

@app.post("/credit-notes")
def create_credit_note(credit_note: dict = Body(...), payload=Depends(require_permission("credit_notes_create"))):
    # Map camelCase to snake_case
    credit_note_data = {
        "credit_note_number": credit_note["creditNoteNumber"],
        "sales_order_id": credit_note.get("salesOrderId"),
        "customer_id": credit_note["customerId"],
        "credit_date": credit_note.get("creditDate", "CURRENT_DATE"),
        "reason": credit_note["reason"],
        "reason_description": credit_note.get("reasonDescription"),
        "status": credit_note.get("status", "draft"),
        "approval_required": credit_note.get("approvalRequired", True),
        "subtotal": credit_note.get("subtotal", 0),
        "tax_amount": credit_note.get("taxAmount", 0),
        "discount_amount": credit_note.get("discountAmount", 0),
        "total_amount": credit_note.get("totalAmount", 0),
        "refund_method": credit_note.get("refundMethod", "credit_account"),
        "affects_inventory": credit_note.get("affectsInventory", True),
        "notes": credit_note.get("notes"),
        "internal_notes": credit_note.get("internalNotes"),
        "created_by": payload.get("sub")  # Use the current user's ID
    }
    data = supabase.table("credit_notes").insert(credit_note_data).execute()
    return JSONResponse(content=data.data)

@app.put("/credit-notes/{credit_note_id}")
def update_credit_note(credit_note_id: str, credit_note: dict = Body(...), payload=Depends(require_permission("credit_notes_edit"))):
    # Map camelCase to snake_case
    credit_note_data = {
        "credit_note_number": credit_note["creditNoteNumber"],
        "sales_order_id": credit_note.get("salesOrderId"),
        "customer_id": credit_note["customerId"],
        "credit_date": credit_note.get("creditDate"),
        "reason": credit_note["reason"],
        "reason_description": credit_note.get("reasonDescription"),
        "status": credit_note.get("status", "draft"),
        "approval_required": credit_note.get("approvalRequired", True),
        "subtotal": credit_note.get("subtotal", 0),
        "tax_amount": credit_note.get("taxAmount", 0),
        "discount_amount": credit_note.get("discountAmount", 0),
        "total_amount": credit_note.get("totalAmount", 0),
        "refund_method": credit_note.get("refundMethod", "credit_account"),
        "affects_inventory": credit_note.get("affectsInventory", True),
        "notes": credit_note.get("notes"),
        "internal_notes": credit_note.get("internalNotes")
    }
    data = supabase.table("credit_notes").update(credit_note_data).eq("id", credit_note_id).execute()
    return JSONResponse(content=data.data)

@app.delete("/credit-notes/{credit_note_id}")
def delete_credit_note(credit_note_id: str, payload=Depends(require_permission("credit_notes_delete"))):
    data = supabase.table("credit_notes").delete().eq("id", credit_note_id).execute()
    return JSONResponse(content=data.data)

# Credit Note Items endpoints
@app.get("/credit-notes/{credit_note_id}/items")
def get_credit_note_items(credit_note_id: str, payload=Depends(require_permission("credit_notes_view"))):
    data = supabase.table("credit_note_items").select("*").eq("credit_note_id", credit_note_id).execute()
    return JSONResponse(content=data.data)

@app.post("/credit-notes/{credit_note_id}/items")
def create_credit_note_item(credit_note_id: str, item: dict = Body(...), payload=Depends(require_permission("credit_notes_edit"))):
    # Map camelCase to snake_case
    item_data = {
        "credit_note_id": credit_note_id,
        "product_id": item["productId"],
        "sales_order_item_id": item.get("salesOrderItemId"),
        "original_quantity": item.get("originalQuantity"),
        "credit_quantity": item["creditQuantity"],
        "unit_price": item["unitPrice"],
        "discount": item.get("discount", 0),
        "tax": item.get("tax", 0),
        "returned_quantity": item.get("returnedQuantity", 0),
        "condition_on_return": item.get("conditionOnReturn", "good"),
        "return_to_stock": item.get("returnToStock", True),
        "batch_number": item.get("batchNumber"),
        "expiry_date": item.get("expiryDate"),
        "storage_location": item.get("storageLocation"),
        "quality_notes": item.get("qualityNotes")
    }
    data = supabase.table("credit_note_items").insert(item_data).execute()
    return JSONResponse(content=data.data)

@app.put("/credit-notes/items/{item_id}")
def update_credit_note_item(item_id: str, item: dict = Body(...), payload=Depends(require_permission("credit_notes_edit"))):
    # Map camelCase to snake_case
    item_data = {
        "product_id": item["productId"],
        "sales_order_item_id": item.get("salesOrderItemId"),
        "original_quantity": item.get("originalQuantity"),
        "credit_quantity": item["creditQuantity"],
        "unit_price": item["unitPrice"],
        "discount": item.get("discount", 0),
        "tax": item.get("tax", 0),
        "returned_quantity": item.get("returnedQuantity", 0),
        "condition_on_return": item.get("conditionOnReturn", "good"),
        "return_to_stock": item.get("returnToStock", True),
        "batch_number": item.get("batchNumber"),
        "expiry_date": item.get("expiryDate"),
        "storage_location": item.get("storageLocation"),
        "quality_notes": item.get("qualityNotes")
    }
    data = supabase.table("credit_note_items").update(item_data).eq("id", item_id).execute()
    return JSONResponse(content=data.data)

@app.delete("/credit-notes/items/{item_id}")
def delete_credit_note_item(item_id: str, payload=Depends(require_permission("credit_notes_edit"))):
    data = supabase.table("credit_note_items").delete().eq("id", item_id).execute()
    return JSONResponse(content=data.data)

# User Settings endpoints
@app.get("/user-settings")
def get_user_settings(payload=Depends(verify_jwt)):
    user_id = payload.get("sub")
    data = supabase.table("user_settings").select("*").eq("user_id", user_id).execute()
    if data.data:
        return JSONResponse(content=to_camel_case_user_setting(data.data[0]))
    return JSONResponse(content={})

@app.post("/user-settings")
def create_user_setting(user_setting: dict = Body(...), payload=Depends(verify_jwt)):
    user_id = payload.get("sub")
    # Map camelCase to snake_case
    setting_data = {
        "user_id": user_id,
        "theme": user_setting.get("theme", "light"),
        "language": user_setting.get("language", "en"),
        "notifications": user_setting.get("notifications", {}),
        "preferences": user_setting.get("preferences", {})
    }
    data = supabase.table("user_settings").insert(setting_data).execute()
    return JSONResponse(content=data.data)

@app.put("/user-settings")
def update_user_setting(user_setting: dict = Body(...), payload=Depends(verify_jwt)):
    user_id = payload.get("sub")
    # Map camelCase to snake_case
    setting_data = {
        "theme": user_setting.get("theme", "light"),
        "language": user_setting.get("language", "en"),
        "notifications": user_setting.get("notifications", {}),
        "preferences": user_setting.get("preferences", {})
    }
    data = supabase.table("user_settings").update(setting_data).eq("user_id", user_id).execute()
    return JSONResponse(content=data.data)

# System Settings endpoints
@app.get("/system-settings")
def get_system_settings(payload=Depends(require_permission("settings_view"))):
    try:
        data = supabase.table("system_settings").select("*").execute()
        if data.data:
            settings = [to_camel_case_system_setting(setting) for setting in data.data]
            return JSONResponse(content=settings)
        else:
            # Return default settings if no settings exist in database
            return JSONResponse(content=get_default_system_settings())
    except Exception as e:
        print(f"Error fetching system settings: {str(e)}")
        # Return default settings on error
        return JSONResponse(content=get_default_system_settings())

def get_default_system_settings():
    """Return default system settings when database is empty or has errors"""
    return [
        {
            "id": "default-company-name",
            "key": "company_name",
            "value": "Versal",
            "type": "string",
            "description": "Company name",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-company-email",
            "key": "company_email",
            "value": "contact@versal.com",
            "type": "string",
            "description": "Company email",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-currency",
            "key": "default_currency",
            "value": "USD",
            "type": "string",
            "description": "Default currency",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-date-format",
            "key": "date_format",
            "value": "MM/DD/YYYY",
            "type": "string",
            "description": "Date format",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-timezone",
            "key": "timezone",
            "value": "UTC",
            "type": "string",
            "description": "Timezone",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-language",
            "key": "language",
            "value": "en",
            "type": "string",
            "description": "Language",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-tax-rate",
            "key": "tax_rate",
            "value": "10.0",
            "type": "string",
            "description": "Default tax rate",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-invoice-prefix",
            "key": "invoice_prefix",
            "value": "INV",
            "type": "string",
            "description": "Invoice prefix",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-credit-note-prefix",
            "key": "credit_note_prefix",
            "value": "CN",
            "type": "string",
            "description": "Credit note prefix",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-purchase-order-prefix",
            "key": "purchase_order_prefix",
            "value": "PO",
            "type": "string",
            "description": "Purchase order prefix",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-grn-prefix",
            "key": "grn_prefix",
            "value": "GRN",
            "type": "string",
            "description": "GRN prefix",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-invoice-number-reset",
            "key": "invoice_number_reset",
            "value": "never",
            "type": "string",
            "description": "Invoice number reset",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-invoice-format-template",
            "key": "invoice_format_template",
            "value": "standard",
            "type": "string",
            "description": "Invoice format template",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-rounding-method",
            "key": "rounding_method",
            "value": "no_rounding",
            "type": "string",
            "description": "Rounding method",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-rounding-precision",
            "key": "rounding_precision",
            "value": "0.01",
            "type": "string",
            "description": "Rounding precision",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-invoice-notes",
            "key": "default_invoice_notes",
            "value": "Thank you for your business",
            "type": "string",
            "description": "Default invoice notes",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-include-company-logo",
            "key": "include_company_logo",
            "value": True,
            "type": "boolean",
            "description": "Include company logo on invoices",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-low-stock-threshold",
            "key": "low_stock_threshold",
            "value": "10",
            "type": "string",
            "description": "Low stock threshold",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-auto-reorder-enabled",
            "key": "auto_reorder_enabled",
            "value": False,
            "type": "boolean",
            "description": "Auto reorder enabled",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-email-notifications-enabled",
            "key": "email_notifications_enabled",
            "value": True,
            "type": "boolean",
            "description": "Email notifications enabled",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-backup-frequency",
            "key": "backup_frequency",
            "value": "daily",
            "type": "string",
            "description": "Backup frequency",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-session-timeout",
            "key": "session_timeout",
            "value": "3600",
            "type": "string",
            "description": "Session timeout",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-tax-calculation-method",
            "key": "tax_calculation_method",
            "value": "exclusive",
            "type": "string",
            "description": "Tax calculation method",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-auto-backup-enabled",
            "key": "auto_backup_enabled",
            "value": True,
            "type": "boolean",
            "description": "Auto backup enabled",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-low-stock-global-threshold",
            "key": "low_stock_global_threshold",
            "value": "10",
            "type": "string",
            "description": "Global low stock threshold",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-multi-warehouse",
            "key": "enable_multi_warehouse",
            "value": False,
            "type": "boolean",
            "description": "Enable multi warehouse",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-grn-auto-numbering",
            "key": "grn_auto_numbering",
            "value": True,
            "type": "boolean",
            "description": "GRN auto numbering",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-po-auto-numbering",
            "key": "po_auto_numbering",
            "value": True,
            "type": "boolean",
            "description": "Purchase order auto numbering",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-invoice-auto-numbering",
            "key": "invoice_auto_numbering",
            "value": True,
            "type": "boolean",
            "description": "Invoice auto numbering",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-signup",
            "key": "enable_signup",
            "value": True,
            "type": "boolean",
            "description": "Enable signup",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-require-email-verification",
            "key": "require_email_verification",
            "value": True,
            "type": "boolean",
            "description": "Require email verification",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-max-login-attempts",
            "key": "max_login_attempts",
            "value": "5",
            "type": "string",
            "description": "Max login attempts",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-lockout-duration",
            "key": "lockout_duration",
            "value": "300",
            "type": "string",
            "description": "Lockout duration",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-password-min-length",
            "key": "password_min_length",
            "value": "8",
            "type": "string",
            "description": "Password minimum length",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-password-require-special",
            "key": "password_require_special",
            "value": True,
            "type": "boolean",
            "description": "Password require special characters",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-session-timeout-warning",
            "key": "session_timeout_warning",
            "value": "300",
            "type": "string",
            "description": "Session timeout warning",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-audit-log",
            "key": "enable_audit_log",
            "value": True,
            "type": "boolean",
            "description": "Enable audit log",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-api-rate-limiting",
            "key": "enable_api_rate_limiting",
            "value": True,
            "type": "boolean",
            "description": "Enable API rate limiting",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-two-factor-auth",
            "key": "enable_two_factor_auth",
            "value": False,
            "type": "boolean",
            "description": "Enable two factor authentication",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-remember-me",
            "key": "enable_remember_me",
            "value": True,
            "type": "boolean",
            "description": "Enable remember me",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-password-reset",
            "key": "enable_password_reset",
            "value": True,
            "type": "boolean",
            "description": "Enable password reset",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-account-lockout",
            "key": "enable_account_lockout",
            "value": True,
            "type": "boolean",
            "description": "Enable account lockout",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-max-file-upload-size",
            "key": "max_file_upload_size",
            "value": "10485760",
            "type": "string",
            "description": "Max file upload size",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-allowed-file-types",
            "key": "allowed_file_types",
            "value": "jpg,jpeg,png,pdf,doc,docx,xls,xlsx",
            "type": "string",
            "description": "Allowed file types",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-backup-retention-days",
            "key": "backup_retention_days",
            "value": "30",
            "type": "string",
            "description": "Backup retention days",
            "isPublic": False,
            "createdAt": None,
            "updatedAt": None
        }
    ]

@app.post("/system-settings")
def create_system_setting(system_setting: dict = Body(...), payload=Depends(require_permission("settings_edit"))):
    # Map camelCase to snake_case and format value as JSON
    setting_type = system_setting.get("type", "string")
    setting_value = system_setting["value"]
    
    # Format the value as JSON based on its type
    if setting_type == "string":
        json_value = json.dumps(setting_value)
    elif setting_type == "number":
        json_value = setting_value  # Numbers are already JSON-compatible
    elif setting_type == "boolean":
        json_value = setting_value  # Booleans are already JSON-compatible
    else:
        json_value = json.dumps(setting_value)
    
    setting_data = {
        "setting_key": system_setting["key"],
        "setting_value": json_value,
        "setting_type": setting_type,
        "description": system_setting.get("description"),
        "is_public": system_setting.get("isPublic", False)
    }
    data = supabase.table("system_settings").insert(setting_data).execute()
    return JSONResponse(content=data.data)

@app.put("/system-settings/{setting_id}")
def update_system_setting(setting_id: str, system_setting: dict = Body(...), payload=Depends(require_permission("settings_edit"))):
    # Map camelCase to snake_case and format value as JSON
    setting_type = system_setting.get("type", "string")
    setting_value = system_setting["value"]
    
    # Format the value as JSON based on its type
    if setting_type == "string":
        json_value = json.dumps(setting_value)
    elif setting_type == "number":
        json_value = setting_value  # Numbers are already JSON-compatible
    elif setting_type == "boolean":
        json_value = setting_value  # Booleans are already JSON-compatible
    else:
        json_value = json.dumps(setting_value)
    
    setting_data = {
        "setting_key": system_setting["key"],
        "setting_value": json_value,
        "setting_type": setting_type,
        "description": system_setting.get("description"),
        "is_public": system_setting.get("isPublic", False)
    }
    data = supabase.table("system_settings").update(setting_data).eq("id", setting_id).execute()
    return JSONResponse(content=data.data)

@app.delete("/system-settings/{setting_id}")
def delete_system_setting(setting_id: str, payload=Depends(require_permission("settings_edit"))):
    data = supabase.table("system_settings").delete().eq("id", setting_id).execute()
    return JSONResponse(content=data.data)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
