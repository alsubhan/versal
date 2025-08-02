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
        "roleId": user.get("role_id"),
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
            # Get user profile with role
            profile_data = supabase.table("profiles").select("role_id").eq("id", user_id).execute()
            if not profile_data.data:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User profile not found"
                )
            
            role_id = profile_data.data[0].get("role_id")
            if not role_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no assigned role"
                )
            
            # Get role permissions
            role_data = supabase.table("roles").select("permissions").eq("id", role_id).execute()
            if not role_data.data:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role not found"
                )
            
            permissions_data = role_data.data[0].get("permissions", [])
            
            # Parse permissions if it's a JSON string, otherwise use as-is
            if isinstance(permissions_data, str):
                try:
                    user_permissions = json.loads(permissions_data)
                except json.JSONDecodeError:
                    user_permissions = []
            else:
                user_permissions = permissions_data or []
            
            # Check if user has the required permission
            if required_permission not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: missing permission '{required_permission}'"
                )
            
            return payload
            
        except Exception as e:
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
        "createdAt": unit.get("created_at"),
        "updatedAt": unit.get("updated_at")
    }

def to_camel_case_tax(tax):
    return {
        "id": tax["id"],
        "name": tax["name"],
        "rate": float(tax["rate"]) if tax.get("rate") else 0,
        "isDefault": tax.get("is_default", False),
        "appliedTo": tax.get("applied_to", "products"),
        "description": tax.get("description"),
        "isActive": tax.get("is_active", True),
        "createdAt": tax.get("created_at"),
        "updatedAt": tax.get("updated_at")
    }

def to_camel_case_supplier(supplier):
    return {
        "id": supplier["id"],
        "name": supplier["name"],
        "contactName": supplier["contact_name"],
        "email": supplier.get("email"),
        "phone": supplier.get("phone"),
        "address": supplier.get("address"),
        "paymentTerms": supplier.get("payment_terms"),
        "taxId": supplier.get("tax_id"),
        "notes": supplier.get("notes"),
        "isActive": supplier.get("is_active", True),
        "createdAt": supplier.get("created_at"),
        "updatedAt": supplier.get("updated_at")
    }

def to_camel_case_customer(customer):
    return {
        "id": customer["id"],
        "name": customer["name"],
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "billingAddress": customer.get("billing_address"),
        "shippingAddress": customer.get("shipping_address"),
        "taxId": customer.get("tax_id"),
        "notes": customer.get("notes"),
        "creditLimit": float(customer["credit_limit"]) if customer.get("credit_limit") else 0,
        "currentCredit": float(customer["current_credit"]) if customer.get("current_credit") else 0,
        "customerType": customer.get("customer_type", "retail"),
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
    data = supabase.table("products").select("*").execute()
    return JSONResponse(content=data.data)

@app.get("/customers")
def get_customers(payload=Depends(verify_jwt)):
    data = supabase.table("customers").select("*").execute()
    customers = [to_camel_case_customer(customer) for customer in data.data]
    return JSONResponse(content=customers)

@app.post("/customers")
def create_customer(customer: dict = Body(...), payload=Depends(require_permission("customers_create"))):
    # Map camelCase to snake_case
    customer_data = {
        "name": customer["name"],
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "billing_address": customer.get("billingAddress"),
        "shipping_address": customer.get("shippingAddress"),
        "tax_id": customer.get("taxId"),
        "notes": customer.get("notes"),
        "credit_limit": customer.get("creditLimit", 0),
        "current_credit": customer.get("currentCredit", 0),
        "customer_type": customer.get("customerType", "retail")
    }
    data = supabase.table("customers").insert(customer_data).execute()
    return JSONResponse(content=data.data)

@app.put("/customers/{customer_id}")
def update_customer(customer_id: str, customer: dict = Body(...), payload=Depends(require_permission("customers_edit"))):
    # Map camelCase to snake_case
    customer_data = {
        "name": customer["name"],
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "billing_address": customer.get("billingAddress"),
        "shipping_address": customer.get("shippingAddress"),
        "tax_id": customer.get("taxId"),
        "notes": customer.get("notes"),
        "credit_limit": customer.get("creditLimit", 0),
        "current_credit": customer.get("currentCredit", 0),
        "customer_type": customer.get("customerType", "retail")
    }
    data = supabase.table("customers").update(customer_data).eq("id", customer_id).execute()
    return JSONResponse(content=data.data)

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
    # Map camelCase to snake_case
    supplier_data = {
        "name": supplier["name"],
        "contact_name": supplier["contactName"],
        "email": supplier.get("email"),
        "phone": supplier.get("phone"),
        "address": supplier.get("address"),
        "payment_terms": supplier.get("paymentTerms"),
        "tax_id": supplier.get("taxId"),
        "notes": supplier.get("notes"),
        "is_active": supplier.get("isActive", True)
    }
    data = supabase.table("suppliers").insert(supplier_data).execute()
    return JSONResponse(content=data.data)

@app.put("/suppliers/{supplier_id}")
def update_supplier(supplier_id: str, supplier: dict = Body(...), payload=Depends(require_permission("suppliers_edit"))):
    # Map camelCase to snake_case
    supplier_data = {
        "name": supplier["name"],
        "contact_name": supplier["contactName"],
        "email": supplier.get("email"),
        "phone": supplier.get("phone"),
        "address": supplier.get("address"),
        "payment_terms": supplier.get("paymentTerms"),
        "tax_id": supplier.get("taxId"),
        "notes": supplier.get("notes"),
        "is_active": supplier.get("isActive", True)
    }
    data = supabase.table("suppliers").update(supplier_data).eq("id", supplier_id).execute()
    return JSONResponse(content=data.data)

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
    # Map camelCase to snake_case
    tax_data = {
        "name": tax["name"],
        "rate": tax["rate"],
        "is_default": tax.get("isDefault", False),
        "applied_to": tax.get("appliedTo", "products"),
        "description": tax.get("description"),
        "is_active": tax.get("isActive", True)
    }
    data = supabase.table("taxes").insert(tax_data).execute()
    return JSONResponse(content=data.data)

@app.put("/taxes/{tax_id}")
def update_tax(tax_id: str, tax: dict = Body(...), payload=Depends(require_permission("taxes_edit"))):
    # Map camelCase to snake_case
    tax_data = {
        "name": tax["name"],
        "rate": tax["rate"],
        "is_default": tax.get("isDefault", False),
        "applied_to": tax.get("appliedTo", "products"),
        "description": tax.get("description"),
        "is_active": tax.get("isActive", True)
    }
    data = supabase.table("taxes").update(tax_data).eq("id", tax_id).execute()
    return JSONResponse(content=data.data)

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
    # Map camelCase to snake_case
    unit_data = {
        "name": unit["name"],
        "abbreviation": unit["abbreviation"],
        "description": unit.get("description")
    }
    data = supabase.table("units").insert(unit_data).execute()
    return JSONResponse(content=data.data)

@app.put("/units/{unit_id}")
def update_unit(unit_id: str, unit: dict = Body(...), payload=Depends(require_permission("units_edit"))):
    # Map camelCase to snake_case
    unit_data = {
        "name": unit["name"],
        "abbreviation": unit["abbreviation"],
        "description": unit.get("description")
    }
    data = supabase.table("units").update(unit_data).eq("id", unit_id).execute()
    return JSONResponse(content=data.data)

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
    categories = [to_camel_case_category(cat) for cat in data.data]
    return JSONResponse(content=categories)

@app.post("/categories")
def create_category(category: dict = Body(...), payload=Depends(verify_jwt)):
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
    data = supabase.table("categories").insert(category).execute()
    return JSONResponse(content=data.data)

@app.put("/categories/{category_id}")
def update_category(category_id: str, category: dict = Body(...), payload=Depends(verify_jwt)):
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
    data = supabase.table("categories").update(category).eq("id", category_id).execute()
    return JSONResponse(content=data.data)

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
    # Get profiles data matching the actual schema
    profiles_data = supabase.table("profiles").select("id, username, full_name, is_active, role_id, created_at, updated_at").execute()
    users = []
    
    for profile in profiles_data.data:
        # Get role name separately to avoid permissions field issues
        role_name = "Unknown"
        if profile.get("role_id"):
            try:
                role_resp = supabase.table("roles").select("name").eq("id", profile["role_id"]).execute()
                if role_resp.data:
                    role_name = role_resp.data[0].get("name", "Unknown")
            except Exception:
                role_name = "Unknown"
        
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
                        
                        # Update the profile with the correct role_id if needed
                        if user.get("role"):
                            try:
                                role_resp = supabase.table("roles").select("id").eq("name", user.get("role")).execute()
                                if role_resp.data:
                                    role_id = role_resp.data[0].get("id")
                                    
                                    # Update profile with role_id
                                    supabase.table("profiles").update({"role_id": role_id}).eq("id", user_id).execute()
                            except Exception as e:
                                print(f"Error updating role_id: {str(e)}")  # Debug log
                        
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
    
    # Map role name to role_id
    if "role" in user_data:
        role_name = user_data.pop("role")
        try:
            role_resp = supabase.table("roles").select("id").eq("name", role_name).execute()
            if role_resp.data:
                user_data["role_id"] = role_resp.data[0].get("id")
        except Exception:
            pass
    
    # Map camelCase to snake_case
    if "roleId" in user_data:
        user_data["role_id"] = user_data.pop("roleId")
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
    """Debug endpoint to check profiles table structure"""
    try:
        # Try to get a single row to see the structure
        result = supabase.table("profiles").select("*").limit(1).execute()
        if result.data:
            # Get the first row to see column names
            sample_row = result.data[0]
            return {
                "columns": list(sample_row.keys()),
                "sample_data": sample_row
            }
        else:
            return {"columns": [], "sample_data": None}
    except Exception as e:
        return {"error": str(e)}

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
    data = supabase.table("system_settings").select("*").execute()
    settings = [to_camel_case_system_setting(setting) for setting in data.data]
    return JSONResponse(content=settings)

@app.get("/public/system-settings")
def get_public_system_settings():
    """Public endpoint for basic system settings that don't require authentication"""
    try:
        # Get only public system settings for better security and performance
        data = supabase.table("system_settings").select("*").eq("is_public", True).execute()
        settings = [to_camel_case_system_setting(setting) for setting in data.data]
        return JSONResponse(content=settings)
    except Exception as e:
        # Return default settings if there's an error - default to disabled signup
        default_settings = [
            {
                "id": "default-signup",
                "key": "enable_signup",
                "value": False,  # Changed from True to False
                "type": "boolean",
                "description": "Enable user signup",
                "isPublic": True,
                "createdAt": None,
                "updatedAt": None
            }
        ]
        return JSONResponse(content=default_settings)

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
