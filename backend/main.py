# -*- coding: utf-8 -*-
from fastapi import FastAPI, Depends, HTTPException, status, Security, Body, Request, UploadFile, File
import os
import json
import random
from datetime import datetime, timedelta, date
from collections import Counter
from supabase import create_client, Client
import os
import subprocess
from datetime import datetime
from fastapi.responses import JSONResponse, FileResponse
from dotenv import load_dotenv
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests
from jose import jwt as jose_jwt
from jose.exceptions import JWTError
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
import sys
from typing import Optional, List, Dict, Any

load_dotenv()  # Load environment variables from .env file

# Check for DEBUG mode from environment variable
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"

if DEBUG_MODE:
    print("🔧 DEBUG MODE ENABLED - Debug endpoints and features are active")
else:
    print("🚀 PRODUCTION MODE - Debug features are disabled")

app = FastAPI(
    title="Versal API",
    description="Inventory Management System API",
    version="1.0.0",
    debug=DEBUG_MODE,
    root_path="/api"
)

def _create_serials_for_grn_item(product_id: str, serial_numbers: List[str], grn_item_id: str):
    print(f"DEBUG: _create_serials_for_grn_item called with product_id: {product_id}, serial_numbers: {serial_numbers}, grn_item_id: {grn_item_id}")
    if not serial_numbers:
        print("DEBUG: No serial numbers provided")
        return
    
    # Note: We don't need product info for inventory transactions anymore
    # since the table only stores product_id, not product_name/sku_code
    
    payload_rows = []
    seen = set()
    for s in serial_numbers:
        s_norm = (s or "").strip()
        if not s_norm or s_norm in seen:
            continue
        seen.add(s_norm)
        payload_rows.append({
            "product_id": product_id,
            "serial_number": s_norm,
            "status": "available",
            "grn_item_id": grn_item_id,
        })
    print(f"DEBUG: Prepared {len(payload_rows)} serial rows to insert")
    if payload_rows:
        result = supabase.table("product_serials").insert(payload_rows).execute()
        print(f"DEBUG: Serial insert result: {result.data if result else 'No result'}")
        
        # Create inventory transaction for RECEIPT of serialized products
        # Since these are new serials being created, we create a single transaction for the batch
        _create_inventory_transaction_for_serial_status_change(
            product_id, 
            "BATCH",  # Special identifier for batch operations
            "none",   # No previous status
            "available", 
            "grn_item", 
            grn_item_id,
            f"Serialized products received - {len(payload_rows)} units with serials: {', '.join([row['serial_number'] for row in payload_rows])}",
            None  # GRN doesn't have user context in this function
        )
    else:
        print("DEBUG: No payload rows to insert")

def _create_inventory_transaction_for_serial_status_change(
    product_id: str, 
    serial_number: str, 
    old_status: str, 
    new_status: str, 
    reference_type: str, 
    reference_id: str,
    notes: str = None,
    created_by: str = None
):
    """
    Create inventory transaction for serial status changes.
    This ensures all serialized product movements are tracked in the ledger.
    """
    try:
        # Note: We don't need product info for inventory transactions anymore
        # since the table only stores product_id, not product_name/sku_code
        
        # Determine transaction type and quantity change based on status transition
        transaction_type = None
        quantity_change = 0
        
        # Special case for batch receipts (new serials being created)
        if old_status == "none" and new_status == "available":
            transaction_type = "receipt"
            quantity_change = +1  # Positive for receipts (addition to inventory)
        elif old_status == "available" and new_status == "reserved":
            transaction_type = "reservation"
            quantity_change = -1  # Reduce available inventory
        elif old_status == "reserved" and new_status == "sold":
            transaction_type = "sale"
            quantity_change = -1  # Reduce reserved inventory
        elif old_status == "available" and new_status == "sold":
            transaction_type = "sale"
            quantity_change = -1  # Reduce available inventory
        elif old_status == "sold" and new_status == "returned":
            transaction_type = "return"
            quantity_change = +1  # Increase available inventory
        elif old_status == "reserved" and new_status == "available":
            transaction_type = "reservation_release"
            quantity_change = +1  # Increase available inventory
        elif old_status in ["available", "reserved", "sold"] and new_status == "scrapped":
            transaction_type = "scrap"
            quantity_change = -1  # Reduce inventory (any status)
        elif old_status == "available" and new_status == "available":
            # This might be a location change or other update
            return
        
        if transaction_type is None:
            print(f"Warning: No transaction type defined for status change {old_status} -> {new_status}")
            return
        
        # Create inventory transaction
        transaction_data = {
            "product_id": product_id,
            "transaction_type": transaction_type,
            "quantity_change": quantity_change,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "notes": notes or f"Serial {serial_number} status changed from {old_status} to {new_status}",
            "created_by": created_by  # Set from the calling function
        }
        
        supabase.table("inventory_transactions").insert(transaction_data).execute()
        print(f"Created inventory transaction for serial {serial_number}: {old_status} -> {new_status}")
        
    except Exception as e:
        print(f"Warning: Failed to create inventory transaction for serial {serial_number}: {e}")
        # Don't fail the main operation if transaction creation fails

def _reserve_or_sell_serials_for_invoice_item(product_id: str, serial_numbers: List[str], sale_invoice_item_id: str, finalize: bool = False, created_by: str = None):
    if not serial_numbers:
        return
    
    # Note: We don't need product info for inventory transactions anymore
    # since the table only stores product_id, not product_name/sku_code
    
    for s in serial_numbers:
        s_norm = (s or "").strip()
        if not s_norm:
            raise HTTPException(status_code=400, detail="Invalid serial number")
        
        res = supabase.table("product_serials").select("id, status").eq("product_id", product_id).eq("serial_number", s_norm).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail=f"Serial '{s_norm}' not found for product")
        
        status_val = res.data[0]["status"]
        
        if finalize:
            if status_val not in ["available", "reserved"]:
                raise HTTPException(status_code=400, detail=f"Serial '{s_norm}' not available to sell")
            
            # Update serial status to sold
            supabase.table("product_serials").update({
                "status": "sold",
                "sale_invoice_item_id": sale_invoice_item_id,
            }).eq("id", res.data[0]["id"]).execute()
            
            # Create inventory transaction for status change
            _create_inventory_transaction_for_serial_status_change(
                product_id, s_norm, status_val, "sold", 
                "sale_invoice_item", sale_invoice_item_id,
                f"Serialized product sold - Serial: {s_norm}",
                created_by
            )
        else:
            if status_val != "available":
                raise HTTPException(status_code=400, detail=f"Serial '{s_norm}' not available")
            
            # Update serial status to reserved
            supabase.table("product_serials").update({
                "status": "reserved",
                "sale_invoice_item_id": sale_invoice_item_id,
            }).eq("id", res.data[0]["id"]).execute()
            
            # Create inventory transaction for status change
            _create_inventory_transaction_for_serial_status_change(
                product_id, s_norm, status_val, "reserved", 
                "sale_invoice_item", sale_invoice_item_id,
                f"Serialized product reserved - Serial: {s_norm}",
                created_by
            )


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:7000",  # Frontend production port (Docker)
        "http://127.0.0.1:7000",  # Alternative localhost (Docker)
        "http://localhost:8080",  # Frontend development server
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",  # React default port
        "http://127.0.0.1:8080",  # Alternative localhost
        "http://127.0.0.1:5173",  # Alternative localhost
        "http://127.0.0.1:3000",  # Alternative localhost
        "http://localhost:4173",  # Vite preview port
        "http://127.0.0.1:4173",  # Vite preview port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")  # Backward compat: treated as PUBLIC if INTERNAL not set
SUPABASE_INTERNAL_URL = os.getenv("SUPABASE_INTERNAL_URL", SUPABASE_URL)
SUPABASE_PUBLIC_URL = os.getenv("SUPABASE_PUBLIC_URL", SUPABASE_URL)
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_INTERNAL_URL:
    raise ValueError("SUPABASE_INTERNAL_URL (or SUPABASE_URL) environment variable is not set")

if not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_SERVICE_KEY environment variable is not set")

SUPABASE_JWKS_URL = f"{SUPABASE_INTERNAL_URL}/auth/v1/.well-known/jwks.json"

# GitHub integration configuration
GITHUB_OWNER = os.getenv("GITHUB_OWNER")
GITHUB_REPO = os.getenv("GITHUB_REPO")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# Labels are now fully dynamic from GitHub; no static defaults injected

def get_supabase_client():
    """Get a fresh Supabase client to avoid connection reuse issues"""
    return create_client(SUPABASE_INTERNAL_URL, SUPABASE_SERVICE_KEY)

# Keep a global client for backward compatibility
supabase: Client = get_supabase_client()
bearer_scheme = HTTPBearer()

# Cache the JWK set
_jwk_set = None

def debug_log(message):
    """Log message only if DEBUG mode is enabled"""
    if DEBUG_MODE:
        print(f"[DEBUG] {message}")

def require_debug_mode():
    """Decorator to require DEBUG mode for endpoints"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            if not DEBUG_MODE:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail="Debug endpoints are only available in DEBUG mode"
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator

"""
===================== SERIAL INVENTORY ENDPOINTS =====================
Note: verify_jwt is defined below; FastAPI evaluates dependencies at runtime,
but some static analyzers complain. Keep these after app and before verify_jwt
or disable lint warnings if needed.
"""

@app.get("/inventory/serials")
def list_serials(product_id: Optional[str] = None, status: Optional[str] = None, payload=Depends(lambda cred=Security(bearer_scheme): verify_jwt(cred))):
    query = supabase.table("product_serials").select("*, products(name, sku_code)")
    if product_id:
        query = query.eq("product_id", product_id)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return JSONResponse(content=res.data)

@app.get("/inventory/serials/lookup")
def lookup_serial(serial: str, payload=Depends(lambda cred=Security(bearer_scheme): verify_jwt(cred))):
    if not serial or not serial.strip():
        raise HTTPException(status_code=400, detail="Serial is required")
    res = supabase.table("product_serials").select("*, products(*)").eq("serial_number", serial.strip()).execute()
    if not res.data:
        return JSONResponse(content={"found": False}, status_code=404)
    row = res.data[0]
    return JSONResponse(content={
        "found": True,
        "productId": row.get("product_id"),
        "status": row.get("status"),
        "product": row.get("products")
    })

def get_jwk_set():
    global _jwk_set
    if _jwk_set is None:
        try:
            print(f"🔍 Fetching JWKS from: {SUPABASE_JWKS_URL}")
            resp = requests.get(SUPABASE_JWKS_URL, timeout=5)
            resp.raise_for_status()
            jwk_data = resp.json()
            # Ensure we return the keys array, not the entire response
            if isinstance(jwk_data, dict) and "keys" in jwk_data:
                _jwk_set = jwk_data
                print(f"✅ JWKS fetched successfully. Found {len(_jwk_set.get('keys', []))} keys")
            else:
                _jwk_set = jwk_data
                print(f"⚠️ JWKS response format unexpected: {type(jwk_data)}")
        except Exception as e:
            print(f"❌ Failed to fetch JWKS from {SUPABASE_JWKS_URL}: {str(e)}")
            # If JWK fetch fails, return a minimal valid JWK set
            _jwk_set = {"keys": []}
    return _jwk_set

def verify_jwt(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)):
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided")
    
    # Try HS256 first (Supabase default for local development)
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET")
    if SUPABASE_JWT_SECRET:
        try:
            payload = jose_jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
            debug_log(f"✅ JWT verified successfully (HS256) for user: {payload.get('sub')}")
            return payload
        except JWTError as e:
            debug_log(f"HS256 verification failed: {str(e)}, trying ES256 with JWKS...")
    
    # Fallback to ES256 with JWKS (for production/cloud Supabase)
    jwk_set = get_jwk_set()
    
    # Check if JWKS is available
    if not jwk_set or not jwk_set.get("keys") or len(jwk_set.get("keys", [])) == 0:
        debug_log(f"⚠️ WARNING: JWKS set is empty or unavailable. JWKS URL: {SUPABASE_JWKS_URL}")
        # Try to refresh JWKS
        global _jwk_set
        _jwk_set = None
        jwk_set = get_jwk_set()
        if not jwk_set or not jwk_set.get("keys") or len(jwk_set.get("keys", [])) == 0:
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"JWKS unavailable and no JWT_SECRET configured. Check SUPABASE_INTERNAL_URL: {SUPABASE_INTERNAL_URL}"
                )
            # If we have JWT_SECRET but HS256 failed, the token might be invalid
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: Could not verify with HS256 or ES256"
            )
    
    try:
        # python-jose will automatically select the correct key from the set
        payload = jose_jwt.decode(token, jwk_set, algorithms=["ES256"], options={"verify_aud": False})
        debug_log(f"✅ JWT verified successfully (ES256) for user: {payload.get('sub')}")
        return payload
    except JWTError as e:
        debug_log(f"❌ JWT verification failed (ES256): {str(e)}")
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
    if not user:
        return None
    return {
        **user,
        "fullName": user.get("full_name"),
        "role": user.get("role"),
        "createdAt": user.get("created_at"),
        "updatedAt": user.get("updated_at"),
    }

async def get_user_role_and_permissions(user_id: str, client: Client) -> Dict[str, Any]:
    """Helper to fetch user role and permissions from database."""
    try:
        # Load profile with joined roles table
        # We try to get role (old enum) for fallback and roles(name, permissions) for newer system
        res = client.table("profiles").select("role, role_id, roles(name, permissions)").eq("id", user_id).execute()
        
        if not res.data:
            return {"role": None, "permissions": []}
            
        profile = res.data[0]
        role_name = profile.get("role")  # Fallback to old enum field if present
        
        role_table_data = profile.get("roles")
        permissions = []
        
        if role_table_data:
            role_name = role_table_data.get("name", role_name)
            permissions = role_table_data.get("permissions", [])
            
        return {
            "role": role_name,
            "permissions": permissions if isinstance(permissions, list) else []
        }
    except Exception as e:
        print(f"Error fetching user role: {str(e)}")
        return {"role": None, "permissions": []}

def require_role(allowed_roles: List[str]):
    async def decorator(payload=Depends(verify_jwt)):
        # Bypass permissions for service_role
        if payload.get("role") == "service_role":
            return payload

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        client = get_supabase_client()
        user_info = await get_user_role_and_permissions(user_id, client)
        
        if user_info["role"] not in allowed_roles:
            # Special case for admin: if they have '*' permission, they pass everything
            if "*" in user_info["permissions"]:
                return payload
                
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: role '{user_info['role']}' not authorized"
            )
        return payload
    return decorator

def require_permission(required_permission: str):
    async def decorator(payload=Depends(verify_jwt)):
        # Bypass permissions for service_role
        if payload.get("role") == "service_role":
            return payload

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        try:
            debug_log(f"Checking permission '{required_permission}' for user {user_id}")
            
            client = get_supabase_client()
            user_info = await get_user_role_and_permissions(user_id, client)
            
            user_permissions = user_info["permissions"]
            user_role = user_info["role"]

            # Admin check: '*' bypasses any specific permission
            if "*" in user_permissions or "admin" == user_role:
                 return payload
                 
            if required_permission not in user_permissions:
                print(f"DEBUG: Permission DENIED. User {user_id} (Role: {user_role}) lacks '{required_permission}'. Available: {user_permissions}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail=f"Forbidden: missing permission '{required_permission}'"
                )

            return payload
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR in require_permission: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Error checking permissions: {str(e)}"
            )

    return decorator


def _get_request_context_info(payload: dict) -> Dict[str, Any]:
    """Extract lightweight user context for auditing in issue creation."""
    user_id = payload.get("sub")
    if not user_id:
        return {"userId": None, "email": None, "role": None, "fullName": None}

    # Try to get full name from profiles table
    full_name = None
    try:
        client = get_supabase_client()
        profile_data = client.table("profiles").select("full_name").eq("id", user_id).execute()
        if profile_data.data:
            full_name = profile_data.data[0].get("full_name")
    except Exception:
        # If profile lookup fails, continue without full name
        pass

    return {
        "userId": user_id,
        "email": payload.get("email") or payload.get("user_metadata", {}).get("email"),
        "role": payload.get("user_metadata", {}).get("role") or payload.get("role_name"),
        "fullName": full_name,
    }


def ensure_storage_bucket(client: Client, bucket_id: str) -> None:
    """Ensure a public storage bucket exists. Raise on failure."""
    try:
        # Check if bucket exists
        try:
            buckets = client.storage.list_buckets()  # type: ignore[attr-defined]
        except Exception:
            buckets = []
        bucket_names = set()
        for b in buckets or []:
            # storage3 returns dicts with 'name' or 'id'
            name = b.get("name") if isinstance(b, dict) else None
            if not name and hasattr(b, "name"):
                name = getattr(b, "name")
            if not name and isinstance(b, dict):
                name = b.get("id")
            if name:
                bucket_names.add(str(name))

        if bucket_id not in bucket_names:
            try:
                # Create bucket without unsupported keyword arguments; visibility handled by signed URLs
                client.storage.create_bucket(bucket_id)  # type: ignore[attr-defined]
            except Exception as e:
                # If create still fails, surface a clear error
                raise HTTPException(status_code=500, detail=f"Failed to create bucket '{bucket_id}': {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bucket setup failed: {str(e)}")

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
    additional_addresses = customer.get("additional_addresses", [])
    
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
    
    if isinstance(additional_addresses, str):
        try:
            import json
            additional_addresses = json.loads(additional_addresses)
        except:
            additional_addresses = []
    
    return {
        "id": customer["id"],
        "name": customer["name"],
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "billingAddress": billing_address or {},
        "shippingAddress": shipping_address or {},
        "additionalAddresses": additional_addresses or [],
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
    """Convert credit note data from snake_case to camelCase"""
    # Transform nested customer if it exists
    customer = credit_note.get("customers")
    if customer:
        customer = to_camel_case_customer(customer)
    
    return {
        "id": credit_note.get("id"),
        "creditNoteNumber": credit_note.get("credit_note_number"),
        "salesOrderId": credit_note.get("sales_order_id"),
        "invoiceId": credit_note.get("invoice_id"),  # NEW: Add invoice_id
        "customerId": credit_note.get("customer_id"),
        "customer": customer,
        "creditDate": credit_note.get("credit_date"),
        "reason": credit_note.get("reason"),
        "reasonDescription": credit_note.get("reason_description"),
        "status": credit_note.get("status", "draft"),
        "approvalRequired": credit_note.get("approval_required", True),
        "approvedBy": credit_note.get("approved_by"),
        "approvedDate": credit_note.get("approved_date"),
        "subtotal": float(credit_note.get("subtotal", 0)),
        "taxAmount": float(credit_note.get("tax_amount", 0)),
        "discountAmount": float(credit_note.get("discount_amount", 0)),
        "totalAmount": float(credit_note.get("total_amount", 0)),
        "roundingAdjustment": float(credit_note.get("rounding_adjustment", 0)),
        "refundMethod": credit_note.get("refund_method", "credit_account"),
        "refundProcessed": credit_note.get("refund_processed", False),
        "refundDate": credit_note.get("refund_date"),
        "refundReference": credit_note.get("refund_reference"),
        "affectsInventory": credit_note.get("affects_inventory", True),
        "inventoryProcessed": credit_note.get("inventory_processed", False),
        "creditNoteType": credit_note.get("credit_note_type", "invoice_linked"),  # NEW: Add credit_note_type
        "notes": credit_note.get("notes"),
        "internalNotes": credit_note.get("internal_notes"),
        "createdBy": credit_note.get("created_by"),
        "createdAt": credit_note.get("created_at"),
        "updatedAt": credit_note.get("updated_at")
    }

def to_camel_case_credit_note_item(item):
    """Convert credit note item data from snake_case to camelCase"""
    return {
        "id": item.get("id"),
        "creditNoteId": item.get("credit_note_id"),
        "productId": item.get("product_id"),
        "productName": item.get("products", {}).get("name") if item.get("products") else item.get("product_name"),
        "skuCode": item.get("products", {}).get("sku_code") if item.get("products") else item.get("sku_code"),
        "hsnCode": item.get("products", {}).get("hsn_code") if item.get("products") else item.get("hsn_code"),
        "salesOrderItemId": item.get("sales_order_item_id"),
        "originalQuantity": item.get("original_quantity"),
        "creditQuantity": item.get("credit_quantity"),
        "unitPrice": item.get("unit_price"),
        "discount": item.get("discount"),
        "tax": item.get("tax"),
        "total": item.get("total"),
        "returnedQuantity": item.get("returned_quantity"),
        "conditionOnReturn": item.get("condition_on_return"),
        "returnToStock": item.get("return_to_stock"),
        "batchNumber": item.get("batch_number"),
        "expiryDate": item.get("expiry_date"),
        "storageLocation": item.get("storage_location"),
        "qualityNotes": item.get("quality_notes"),
        "saleTaxType": item.get("sale_tax_type"),
        "unitAbbreviation": item.get("unit_abbreviation"),
        "createdBy": item.get("created_by"),
        "reason": item.get("reason"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
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


# --- Feedback and Issue Reporting ---
@app.post("/feedback/github-issue")
def create_github_issue(feedback: dict = Body(...), payload=Depends(verify_jwt)):
    """Create a GitHub issue in the configured repository from user feedback.

    Expected body: {
      title: string,
      description: string,
      pageUrl?: string,
      severity?: 'low'|'medium'|'high',
      stepsToReproduce?: string,
      expected?: string,
      actual?: string,
      labels?: string[]
    }
    """
    if not (GITHUB_OWNER and GITHUB_REPO and GITHUB_TOKEN):
        raise HTTPException(status_code=500, detail="GitHub integration not configured on server")

    title = feedback.get("title") or "User feedback"
    description = feedback.get("description") or ""
    page_url = feedback.get("pageUrl")
    severity = feedback.get("severity")
    steps = feedback.get("stepsToReproduce")
    expected = feedback.get("expected")
    actual = feedback.get("actual")
    user_ctx = _get_request_context_info(payload)
    screenshot_url = feedback.get("screenshotUrl")

    # Compose issue body
    body_lines: List[str] = []
    if description:
        body_lines.append(description)
    body_lines.append("")
    body_lines.append("---")
    body_lines.append("Context")
    body_lines.append("")
    if page_url:
        body_lines.append(f"- Page: {page_url}")
    if severity:
        body_lines.append(f"- Severity: {severity}")
    if steps:
        body_lines.append("")
        body_lines.append("Steps to reproduce:")
        body_lines.append(steps)
    if expected or actual:
        body_lines.append("")
        body_lines.append("Expected vs actual:")
        if expected:
            body_lines.append(f"- Expected: {expected}")
        if actual:
            body_lines.append(f"- Actual: {actual}")
    body_lines.append("")
    if screenshot_url:
        body_lines.append("Screenshot")
        body_lines.append("")
        body_lines.append(f"![screenshot]({screenshot_url})")
        body_lines.append("")
    body_lines.append("Reporter")
    body_lines.append("")
    if user_ctx.get("fullName"):
        body_lines.append(f"- Name: {user_ctx.get('fullName')}")
    if user_ctx.get("email"):
        body_lines.append(f"- Email: {user_ctx.get('email')}")
    if user_ctx.get("role"):
        body_lines.append(f"- Role: {user_ctx.get('role')}")

    issue_body = "\n".join(body_lines)

    labels = feedback.get("labels") or []
    if not isinstance(labels, list):
        labels = []
    # Merge with defaults; de-duplicate
    merged_labels = list({
        *(l for l in (label.strip() for label in labels if isinstance(label, str)) if l),
    })
    # Optionally add severity tag if it exists in repo; keep simple and always include
    if severity in ["low", "medium", "high"]:
        merged_labels.append(f"severity:{severity}")

    api_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/issues"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "versal-app",
    }

    try:
        resp = requests.post(api_url, headers=headers, json={
            "title": title[:250] if title else "Feedback",
            "body": issue_body,
            "labels": merged_labels,
        })
        if resp.status_code >= 300:
            try:
                detail = resp.json()
            except Exception:
                detail = {"message": resp.text}
            raise HTTPException(status_code=resp.status_code, detail=detail)
        data = resp.json()
        return {"html_url": data.get("html_url"), "number": data.get("number")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create GitHub issue: {str(e)}")


@app.get("/feedback/github-labels")
def get_github_labels(payload=Depends(verify_jwt)):
    if not (GITHUB_OWNER and GITHUB_REPO and GITHUB_TOKEN):
        raise HTTPException(status_code=500, detail="GitHub integration not configured on server")

    api_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/labels?per_page=100"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "versal-app",
    }
    try:
        resp = requests.get(api_url, headers=headers, timeout=15)
        if resp.status_code >= 300:
            try:
                detail = resp.json()
            except Exception:
                detail = {"message": resp.text}
            raise HTTPException(status_code=resp.status_code, detail=detail)
        data = resp.json()
        # Return simplified label info
        return [{"name": l.get("name"), "color": l.get("color"), "default": l.get("default", False)} for l in data]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch labels: {str(e)}")


@app.post("/feedback/upload-screenshot")
def upload_screenshot(file: UploadFile = File(...), payload=Depends(verify_jwt)):
    """Upload a screenshot to Supabase Storage and return a public URL."""
    try:
        client = get_supabase_client()
        bucket = "issue-screenshots"
        # Ensure bucket exists and is public
        ensure_storage_bucket(client, bucket)

        # Build object path
        safe_filename = (file.filename or "screenshot.png").replace("/", "_").replace("\\", "_")
        timestamp = datetime.utcnow().isoformat().replace(":", "-")
        user_id = payload.get("sub") or "anonymous"
        path = f"{user_id}/{timestamp}-{safe_filename}"

        # Upload file
        try:
            # Read entire file content into bytes
            contents = file.file.read()
            if contents is None:
                contents = b""
            client.storage.from_(bucket).upload(
                path=path,
                file=contents,
                file_options={
                    "content-type": file.content_type or "image/png",
                    "x-upsert": "true",
                },
            )  # type: ignore[attr-defined]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

        # Construct public URL (works if bucket is public)
        # Prefer a signed URL so bucket does not have to be public
        signed = None
        try:
            signed = client.storage.from_(bucket).create_signed_url(path=path, expires_in=31536000)  # type: ignore[attr-defined]
        except Exception:
            signed = None

        if isinstance(signed, dict):
            signed_url = signed.get("signedURL") or signed.get("signed_url")
            if signed_url:
                # Some clients return a path starting with "/storage/..."; if so, prepend base
                if signed_url.startswith("http://") or signed_url.startswith("https://"):
                    return {"url": signed_url, "path": path}
                public_base = SUPABASE_PUBLIC_URL or SUPABASE_INTERNAL_URL
                return {"url": f"{public_base}{signed_url}", "path": path}

        # Fallback: construct public-style URL (may require bucket to be public)
        public_base = SUPABASE_PUBLIC_URL or SUPABASE_INTERNAL_URL
        public_url = f"{public_base}/storage/v1/object/public/{bucket}/{path}"
        return {"url": public_url, "path": path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload screenshot: {str(e)}")

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
    return {"message": "Hello, Versal!"}

@app.get("/debug/status")
@require_debug_mode()
def debug_status():
    """Get debug mode status and available debug endpoints"""
    return {
        "debug_mode": DEBUG_MODE,
        "available_debug_endpoints": [
            "/debug/status",
            "/debug/roles-schema",
            "/debug/profiles-schema", 
            "/debug/stock-levels-schema",
            "/debug/inventory-transactions-schema",
            "/debug/products",
            "/debug/stock-levels"
        ],
        "message": "Debug mode is active. Use these endpoints for troubleshooting."
    }

@app.get("/debug/roles-schema")
@require_debug_mode()
def debug_roles_schema():
    try:
        # Test query to check roles table schema
        data = supabase.table("roles").select("*").limit(1).execute()
        return {"message": "Roles table accessible", "sample_data": data.data}
    except Exception as e:
        return {"error": str(e), "message": "Roles table error"}

@app.get("/debug/profiles-schema")
@require_debug_mode()
def debug_profiles_schema():
    try:
        # Test query to check profiles table schema
        data = supabase.table("profiles").select("*").limit(1).execute()
        return {"message": "Profiles table accessible", "sample_data": data.data}
    except Exception as e:
        return {"error": str(e), "message": "Profiles table error"}

@app.get("/debug/stock-levels-schema")
@require_debug_mode()
def debug_stock_levels_schema():
    try:
        # Test query to check stock_levels table schema
        data = supabase.table("stock_levels").select("*").limit(1).execute()
        return {"message": "Stock levels table accessible", "sample_data": data.data}
    except Exception as e:
        return {"error": str(e), "message": "Stock levels table error"}

@app.get("/debug/inventory-transactions-schema")
@require_debug_mode()
def debug_inventory_transactions_schema():
    try:
        # Test query to check inventory_transactions table schema
        data = supabase.table("inventory_transactions").select("*").limit(1).execute()
        return {"message": "Inventory transactions table accessible", "sample_data": data.data}
    except Exception as e:
        return {"error": str(e), "message": "Inventory transactions table error"}

@app.get("/products")
def get_products(payload=Depends(verify_jwt)):
    try:
        debug_log("Products endpoint: Starting query with stock_levels...")
        # Query products with related category, unit, stock data, and tax information
        # Use specific relationship names to avoid conflicts
        products_data = supabase.table("products").select("""
            *,
            categories!products_category_id_fkey(name),
            units(name, abbreviation),
            stock_levels(quantity_on_hand, quantity_available),
            purchase_tax:taxes!products_purchase_tax_id_fkey(id, name, rate),
            sale_tax:taxes!products_sale_tax_id_fkey(id, name, rate)
        """).execute()
        
        debug_log(f"Products endpoint: Query successful, got {len(products_data.data) if products_data.data else 0} products")
        
        if products_data.data:
            # Process the data to ensure stock_levels is always an array
            processed_data = []
            for product in products_data.data:
                debug_log(f"Processing product {product.get('name', 'Unknown')}: stock_levels = {product.get('stock_levels')}")
                debug_log(f"Product {product.get('name', 'Unknown')}: reorder_point = {product.get('reorder_point')} (type: {type(product.get('reorder_point'))})")
                # Convert stock_levels object to array if it's not already
                if product.get('stock_levels') and not isinstance(product['stock_levels'], list):
                    product['stock_levels'] = [product['stock_levels']]
                elif not product.get('stock_levels'):
                    product['stock_levels'] = []
                processed_data.append(product)
            
            debug_log(f"Products endpoint: Returning {len(processed_data)} processed products")
            return JSONResponse(content=processed_data)
        else:
            debug_log("Products endpoint: No data returned from query")
            return JSONResponse(content=[])
            
    except Exception as e:
        debug_log(f"Exception in products endpoint: {str(e)}")
        # Fallback to basic query if join fails
        try:
            debug_log("Products endpoint: Trying fallback query...")
            products_data = supabase.table("products").select("*").execute()
            debug_log(f"Fallback query returned {len(products_data.data) if products_data.data else 0} products")
            return JSONResponse(content=products_data.data or [])
        except Exception as fallback_error:
            debug_log(f"Fallback query also failed: {str(fallback_error)}")
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
        
        # if check_duplicate_hsn_code(hsn_code):
        #     raise HTTPException(status_code=409, detail=f"A product with HSN code '{hsn_code}' already exists")
        
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
        initial_quantity = product.get("initialQty", 0) or product.get("initial_quantity", 0)
        debug_log(f"Create product: initial_quantity = {initial_quantity}, product_id = {created_product.get('id') if created_product else 'None'}")
        
        # Always create stock level record, even if initial_quantity is 0
        if created_product:
            try:
                # Create stock level record with proper field mapping
                stock_data = {
                    "product_id": created_product["id"],
                    "quantity_on_hand": initial_quantity or 0,
                    "quantity_reserved": 0,
                    "created_by": payload.get("sub")
                    # quantity_available is a generated column, so we don't set it
                }
                debug_log(f"Creating stock level with data: {stock_data}")
                
                # Create the stock level
                stock_result = supabase.table("stock_levels").insert(stock_data).execute()
                debug_log(f"Stock level created successfully for product {created_product['id']}")
                
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
                        debug_log(f"Created inventory transaction for initial stock")
                    except Exception as transaction_error:
                        debug_log(f"Error creating inventory transaction: {str(transaction_error)}")
                        # Don't fail if transaction creation fails
                else:
                    debug_log(f"Stock level created for product {created_product['id']} with quantity: {initial_quantity}")
                    
            except Exception as stock_error:
                debug_log(f"Error creating stock level: {str(stock_error)}")
                # Check if it's a unique constraint violation (stock level already exists)
                if "duplicate key value violates unique constraint" in str(stock_error) and "stock_levels_product_id_key" in str(stock_error):
                    debug_log(f"Stock level already exists for product {created_product['id']}, skipping stock creation")
                else:
                    debug_log(f"Unexpected error creating stock level: {str(stock_error)}")
                # Don't fail the product creation if stock creation fails
        
        return JSONResponse(content=created_product)
        
    except Exception as e:
        debug_log(f"Error creating product: {str(e)}")
        
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
        
        # if check_duplicate_hsn_code(hsn_code, product_id):
        #    raise HTTPException(status_code=409, detail=f"A product with HSN code '{hsn_code}' already exists")
        
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
    try:
        fresh = get_supabase_client()
        data = fresh.table("customers").select("*").execute()
    except httpx.RemoteProtocolError:
        # Retry once with a brand-new client to avoid HTTP/2 connection reuse issues
        fresh = get_supabase_client()
        data = fresh.table("customers").select("*").execute()
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
            "additional_addresses": customer.get("additionalAddresses", []),
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
            "additional_addresses": customer.get("additionalAddresses", []),
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

@app.get("/customers/{customer_id}/credit-balance")
def get_customer_credit_balance(customer_id: str, payload=Depends(require_permission("customers_view"))):
    """Get a customer's credit balance."""
    data = supabase.table("customer_credit_balances").select("total_credit_balance").eq("customer_id", customer_id).execute()
    if not data.data:
        return JSONResponse(content={"creditBalance": 0})
    return JSONResponse(content={"creditBalance": data.data[0]["total_credit_balance"]})

@app.get("/customers/{customer_id}/frequent-items")
def get_frequent_items(customer_id: str, payload=Depends(verify_jwt)):
    """Analyze historical sales to find the most frequent products for a customer."""
    try:
        fresh_supabase = get_supabase_client()
        # Fetch up to 100 historical items for this customer
        data = fresh_supabase.table("sales_order_items") \
            .select("*, products(*), sales_orders!inner(customer_id, order_date)") \
            .eq("sales_orders.customer_id", customer_id) \
            .order("sales_orders.order_date", desc=True) \
            .limit(100) \
            .execute()
            
        if not data.data:
            return JSONResponse(content=[])
            
        # Count product occurrences
        product_counts = Counter([item["product_id"] for item in data.data])
        # Get top 5 product IDs
        top_product_ids = [pid for pid, _ in product_counts.most_common(5)]
        
        # Collect unique items for the top products using the most recent order data
        top_items = []
        seen_products = set()
        # Data is already sorted by date desc, so the first match for a pid is the most recent
        for item in data.data:
            pid = item["product_id"]
            if pid in top_product_ids and pid not in seen_products:
                transformed_item = to_camel_case_sales_order_item(item)
                # Reset quantity and totals for template use
                transformed_item["quantity"] = 1
                # Discount might not carry over
                transformed_item["discount"] = 0
                top_items.append(transformed_item)
                seen_products.add(pid)
                if len(top_items) >= 5:
                    break
                    
        return JSONResponse(content=top_items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch frequent items: {str(e)}")


@app.get("/suppliers")
def get_suppliers(payload=Depends(verify_jwt)):
    try:
        client = get_supabase_client()
        data = client.table("suppliers").select("*").execute()
    except (httpx.RemoteProtocolError, httpx.ConnectError):
        client = get_supabase_client()
        data = client.table("suppliers").select("*").execute()
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
    try:
        client = get_supabase_client()
        data = client.table("taxes").select("*").execute()
    except httpx.RemoteProtocolError:
        client = get_supabase_client()
        data = client.table("taxes").select("*").execute()
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
    # Get all stock levels (non-serialized products)
    data = supabase.table("stock_levels").select(
        "*, products(name, sku_code, is_serialized), locations(name)"
    ).execute()
    
    # Get serialized product counts from product_serials table
    serialized_data = supabase.table("product_serials").select(
        "product_id, status, products(name, sku_code)"
    ).execute()
    
    # Aggregate serialized product counts
    serialized_counts = {}
    for serial in serialized_data.data:
        product_id = serial["product_id"]
        status = serial["status"]
        product = serial.get("products") or {}
        
        if product_id not in serialized_counts:
            serialized_counts[product_id] = {
                "product_id": product_id,
                "product_name": product.get("name", "Unknown Product") if product else "Unknown Product",
                "sku_code": product.get("sku_code", "Unknown SKU") if product else "Unknown SKU",
                "is_serialized": True,
                "quantity_on_hand": 0,
                "quantity_reserved": 0,
                "quantity_available": 0
            }
        
        if status == "available":
            serialized_counts[product_id]["quantity_available"] += 1
            serialized_counts[product_id]["quantity_on_hand"] += 1
        elif status == "reserved":
            serialized_counts[product_id]["quantity_reserved"] += 1
            serialized_counts[product_id]["quantity_on_hand"] += 1
        elif status == "sold":
            serialized_counts[product_id]["quantity_on_hand"] += 1
        # Note: returned and scrapped items are not counted in on-hand
    
    stock_levels = []
    
    # Add non-serialized stock levels
    for level in data.data:
        product = level.get("products") or {}
        location = level.get("locations") or {}
        is_serialized = product.get("is_serialized", False) if product else False
        
        # Skip serialized products as they're handled separately
        if is_serialized:
            continue
            
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
            "lastUpdated": level.get("last_updated"),
            "isSerialized": False
        }
        stock_levels.append(stock_level)
    
    # Add aggregated serialized product stock levels
    for product_id, counts in serialized_counts.items():
        stock_level = {
            "id": f"serialized_{product_id}",  # Virtual ID for serialized products
            "productId": product_id,
            "productName": counts["product_name"],
            "skuCode": counts["sku_code"],
            "locationId": None,  # Serialized products don't have specific locations in stock_levels
            "locationName": "N/A",  # Serialized products show individual locations in product_serials
            "quantity": counts["quantity_on_hand"],
            "quantityReserved": counts["quantity_reserved"],
            "quantityAvailable": counts["quantity_available"],
            "minStockLevel": 0,
            "maxStockLevel": 0,
            "reorderPoint": 0,
            "lastUpdated": None,  # Will be updated when serials change
            "isSerialized": True
        }
        stock_levels.append(stock_level)
    
    return JSONResponse(content=stock_levels)

@app.post("/inventory/stock-levels")
def create_stock_level(stock_level: dict = Body(...), payload=Depends(require_permission("inventory_stock_manage"))):
    product_id = stock_level.get("productId")
    location_id = stock_level.get("locationId")
    quantity = stock_level.get("quantity", 0)
    serial_numbers = stock_level.get("serialNumbers", [])
    
    if not product_id:
        raise HTTPException(status_code=400, detail="Product ID is required")
    
    # Check if product is serialized
    product_data = supabase.table("products").select("is_serialized").eq("id", product_id).execute()
    if not product_data.data:
        raise HTTPException(status_code=404, detail="Product not found")
    
    is_serialized = product_data.data[0].get("is_serialized", False)
    
    # Handle serialized products
    if is_serialized:
        if not serial_numbers or len(serial_numbers) == 0:
            raise HTTPException(
                status_code=400, 
                detail="Serial numbers are required for serialized products"
            )
        
        if len(serial_numbers) != quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Serial count ({len(serial_numbers)}) must match quantity ({quantity})"
            )
        
        # Validate serial numbers don't already exist
        existing_serials = supabase.table("product_serials").select("serial_number").eq("product_id", product_id).in_("serial_number", serial_numbers).execute()
        if existing_serials.data and len(existing_serials.data) > 0:
            existing = [s["serial_number"] for s in existing_serials.data]
            raise HTTPException(
                status_code=400,
                detail=f"Serial numbers already exist: {', '.join(existing)}"
            )
        
        # Create product_serials entries
        serial_payload = []
        for serial in serial_numbers:
            serial_norm = (serial or "").strip()
            if not serial_norm:
                continue
            serial_payload.append({
                "product_id": product_id,
                "serial_number": serial_norm,
                "status": "available",
                "location_id": location_id,
            })
        
        if serial_payload:
            serial_result = supabase.table("product_serials").insert(serial_payload).execute()
            
            # Create inventory transaction for batch receipt
            if serial_result.data:
                _create_inventory_transaction_for_serial_status_change(
                    product_id,
                    "BATCH",
                    "none",
                    "available",
                    "stock_level_creation",
                    None,  # No specific reference ID for stock level creation
                    f"Serialized products added via stock level - {len(serial_payload)} units with serials: {', '.join([s['serial_number'] for s in serial_payload])}",
                    payload.get("sub")
                )
        
        # For serialized products, stock_levels counters are updated automatically by triggers
        # We still create a stock_levels record if it doesn't exist (for location tracking)
        # But quantity_on_hand should be 0 as it's managed by serialized counters
        mapped_data = {
            "product_id": product_id,
            "location_id": location_id,
            "quantity_on_hand": 0,  # Serialized products use serialized_available counter
            "created_by": payload.get("sub")
        }
        
        # Check if stock level already exists
        existing_stock = supabase.table("stock_levels").select("id").eq("product_id", product_id).eq("location_id", location_id).execute()
        
        if existing_stock.data:
            # Update existing stock level (triggers will handle counters)
            data = supabase.table("stock_levels").update(mapped_data).eq("id", existing_stock.data[0]["id"]).execute()
        else:
            # Create new stock level
            data = supabase.table("stock_levels").insert(mapped_data).execute()
        
        return JSONResponse(content=data.data if data.data else [])
    
    # Handle non-serialized products (original logic)
    mapped_data = {}
    if product_id:
        mapped_data["product_id"] = product_id
    if location_id:
        mapped_data["location_id"] = location_id
    if quantity is not None:
        mapped_data["quantity_on_hand"] = quantity
    
    # Add created_by field
    mapped_data["created_by"] = payload.get("sub")
    
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
    try:
        print(f"Starting update_stock_level for ID: {stock_level_id}")
        print(f"Received stock_level data: {stock_level}")
        
        # Get current stock level to check product
        current_stock = supabase.table("stock_levels").select("product_id, products(is_serialized)").eq("id", stock_level_id).execute()
        
        if not current_stock.data:
            raise HTTPException(status_code=404, detail="Stock level not found")
        
        product_id = current_stock.data[0].get("product_id")
        product_info = current_stock.data[0].get("products") or {}
        is_serialized = product_info.get("is_serialized", False)
        
        # For serialized products, prevent direct quantity updates
        # Stock levels for serialized products are managed through product_serials table
        if is_serialized:
            if "quantity" in stock_level or "quantityReserved" in stock_level:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot directly update quantity for serialized products. Use GRN, adjustments, or other transactions to manage serialized inventory."
                )
            
            # Only allow location updates for serialized products
            mapped_data = {}
            if "locationId" in stock_level:
                mapped_data["location_id"] = stock_level["locationId"]
            
            if not mapped_data:
                raise HTTPException(
                    status_code=400,
                    detail="No valid fields to update for serialized product stock level"
                )
            
            # Update location only
            data = supabase.table("stock_levels").update(mapped_data).eq("id", stock_level_id).execute()
            
            if not data.data:
                raise HTTPException(status_code=404, detail="Stock level not found after update")
            
            return JSONResponse(content=data.data[0])
        
        # For non-serialized products, use original logic
        mapped_data = {
            "product_id": stock_level.get("productId"),
            "location_id": stock_level.get("locationId"),
            "quantity_on_hand": stock_level.get("quantity"),
            "quantity_reserved": stock_level.get("quantityReserved", 0),
            "quantity_available": stock_level.get("quantityAvailable"),
            "last_updated": stock_level.get("lastUpdated")
            # Don't update created_by for existing records
        }
        
        # Remove None values to avoid overwriting with null
        mapped_data = {k: v for k, v in mapped_data.items() if v is not None}
        print(f"Mapped data for update: {mapped_data}")
        
        # Update the stock level
        print("Executing stock level update...")
        print(f"Final mapped_data being sent: {mapped_data}")
        print(f"Stock level ID: {stock_level_id}")
        
        # Update the stock level
        data = supabase.table("stock_levels").update(mapped_data).eq("id", stock_level_id).execute()
        
        if not data.data:
            raise HTTPException(status_code=404, detail="Stock level not found")
        
        # The database trigger will automatically create inventory transactions
        # No need to manually create them here to avoid conflicts
        
        # Return the updated stock level data directly
        updated_stock_level = data.data[0]
        return JSONResponse(content=updated_stock_level)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating stock level: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update stock level: {str(e)}")

@app.delete("/inventory/stock-levels/{stock_level_id}")
def delete_stock_level(stock_level_id: str, payload=Depends(require_permission("inventory_stock_manage"))):
    data = supabase.table("stock_levels").delete().eq("id", stock_level_id).execute()
    return JSONResponse(content=data.data)

# Inventory Movements endpoints
@app.get("/inventory/movements")
def get_inventory_movements(payload=Depends(require_permission("inventory_movements_view"))):
    # Join with products, locations, and profiles to get product names, SKU codes, location names, and user names
    data = supabase.table("inventory_movements").select(
        "*, products(name, sku_code), from_location:from_location_id(name), to_location:to_location_id(name), created_by_user:created_by(full_name)"
    ).execute()
    
    movements = []
    for movement in data.data:
        # Extract product info from the joined data
        product = movement.get("products", {})
        from_location = movement.get("from_location", {})
        to_location = movement.get("to_location", {})
        created_by_user = movement.get("created_by_user", {})
        
        movement_data = {
            "id": movement.get("id"),
            "productId": movement.get("product_id"),
            "productName": product.get("name") if product else None,
            "skuCode": product.get("sku_code") if product else None,
            "type": movement.get("type"),
            "quantity": int(movement.get("quantity", 0)) if movement.get("quantity") is not None else 0,
            "previousStock": int(movement.get("previous_stock", 0)) if movement.get("previous_stock") is not None else 0,
            "newStock": int(movement.get("new_stock", 0)) if movement.get("new_stock") is not None else 0,
            "fromLocationId": movement.get("from_location_id"),
            "fromLocationName": from_location.get("name") if from_location else None,
            "toLocationId": movement.get("to_location_id"),
            "toLocationName": to_location.get("name") if to_location else None,
            "reference": movement.get("reference"),
            "notes": movement.get("notes"),
            "createdBy": created_by_user.get("full_name") if created_by_user else movement.get("created_by"),
            "createdAt": movement.get("created_at")
        }
        movements.append(movement_data)
    
    return JSONResponse(content=movements)

@app.post("/inventory/movements")
def create_inventory_movement(movement: dict = Body(...), payload=Depends(require_permission("inventory_movements_create"))):
    # Add created_by field to the movement data
    movement["created_by"] = payload.get("sub")
    
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
    try:
        res = supabase.table("roles").select("*").execute()
        roles_data = [to_camel_case_role(role) for role in res.data]
        return JSONResponse(content=roles_data)
    except Exception as e:
        print(f"Error fetching roles: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching roles: {str(e)}"
        )

# Helper function to check for duplicate role names
def check_duplicate_role_name(name: str, exclude_role_id: str = None):
    try:
        query = supabase.table("roles").select("id").eq("name", name)
        if exclude_role_id:
            query = query.neq("id", exclude_role_id)
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
def create_role(role_data: dict = Body(...), payload=Depends(require_role(["admin"]))):
    # Check for duplicate role name
    if check_duplicate_role_name(role_data.get("name")):
        raise HTTPException(status_code=409, detail=f"A role with name '{role_data.get('name')}' already exists")
    
    # Map camelCase to snake_case
    if "createdAt" in role_data:
        role_data["created_at"] = role_data.pop("createdAt")
    if "updatedAt" in role_data:
        role_data["updated_at"] = role_data.pop("updatedAt")
    
    try:
        data = supabase.table("roles").insert(role_data).execute()
        return JSONResponse(content=to_camel_case_role(data.data[0]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/roles/{role_id}")
def update_role(role_id: str, role: dict = Body(...), payload=Depends(require_role(["admin"]))):
    # Check for duplicate role name if name is being changed
    new_role_name = role.get("name")
    if new_role_name:
        if check_duplicate_role_name(new_role_name, role_id):
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
        existing_role = supabase.table("roles").select("created_at").eq("id", role_id).execute()
        if existing_role.data and existing_role.data[0].get("created_at"):
            role.pop("created_at")  # Don't update existing created_at
    
    data = supabase.table("roles").update(role).eq("id", role_id).execute()
    return JSONResponse(content=to_camel_case_role(data.data[0]))

@app.delete("/roles/{role_id}")
def delete_role(role_id: str, payload=Depends(require_role(["admin"]))):
    try:
        # Check if any users are assigned to this role
        users_count = supabase.table("profiles").select("id", count="exact").eq("role_id", role_id).execute()
        if users_count.count and users_count.count > 0:
            raise HTTPException(status_code=400, detail="Cannot delete role that is assigned to users")
            
        data = supabase.table("roles").delete().eq("id", role_id).execute()
        return JSONResponse(content={"message": "Role deleted successfully"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Users Endpoints ---
@app.get("/users")
def get_users(payload=Depends(require_role(["admin"]))):
    try:
        # Get profiles data with joined roles
        profiles_data = supabase.table("profiles").select("id, username, full_name, is_active, role, role_id, created_at, updated_at, roles(name, permissions)").execute()
    except Exception as e:
        print(f"Error fetching profiles: {str(e)}")
        return JSONResponse(content=[])
    
    users = []
    
    for profile in profiles_data.data:
        # Get role name from linked roles table or fallback to role (enum)
        role_table_data = profile.get("roles")
        role_name = profile.get("role", "staff")
        role_id = profile.get("role_id")
        
        if role_table_data:
            role_name = role_table_data.get("name", role_name)
        
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
            "role_id": role_id,
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
            
            # Validate environment variables
            anon_key = os.getenv("SUPABASE_ANON_KEY")
            if not anon_key:
                raise HTTPException(
                    status_code=500, 
                    detail="SUPABASE_ANON_KEY environment variable is not set. Cannot create user."
                )
            
            # Use PUBLIC URL if available (for external access), otherwise fall back to INTERNAL URL
            # When running in Docker, INTERNAL URL should work for backend-to-backend calls
            supabase_url_for_auth = SUPABASE_PUBLIC_URL or SUPABASE_INTERNAL_URL
            if not supabase_url_for_auth:
                raise HTTPException(
                    status_code=500,
                    detail="Neither SUPABASE_PUBLIC_URL nor SUPABASE_INTERNAL_URL is set. Cannot create user."
                )
            
            anon_supabase = create_client(supabase_url_for_auth, anon_key)
            
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
            
            # Check for auth errors
            if not auth_response.user:
                error_msg = "Failed to create user in Supabase Auth"
                if hasattr(auth_response, 'error') and auth_response.error:
                    error_msg += f": {auth_response.error.message}"
                elif hasattr(auth_response, 'error') and auth_response.error:
                    error_msg += f": {str(auth_response.error)}"
                raise HTTPException(status_code=500, detail=error_msg)
            
            # User was created successfully
            if auth_response.user:
                user_id = auth_response.user.id
                
                # The database trigger should have created the profile automatically
                # Let's verify by fetching the profile
                try:
                    profile_data = supabase.table("profiles").select("*").eq("id", user_id).execute()
                    if profile_data.data:
                        profile = profile_data.data[0]
                        
                        # The database trigger handle_new_user should have correctly set the role 
                        # enum from the user_metadata. No manual role_id lookup needed.
                        pass
                        
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
    
    # Set role directly as ENUM string on profile
    if "role" in user_data:
        role_name = user_data["role"]
        if role_name not in ["admin", "staff"]:
            # Default to staff if an unexpected role comes in (like manager which we removed)
            user_data["role"] = "staff"
        else:
            user_data["role"] = role_name
    
    # Remove any role_id / roleId references
    user_data.pop("role_id", None)
    user_data.pop("roleId", None)
    if "createdAt" in user_data:
        user_data["created_at"] = user_data.pop("createdAt")
    if "updatedAt" in user_data:
        user_data["updated_at"] = user_data.pop("updatedAt")
    
    # Update name field to full_name if present
    if "name" in user_data:
        user_data["full_name"] = user_data.pop("name")
    
    data = supabase.table("profiles").update(user_data).eq("id", user_id).execute()
    return JSONResponse(content=data.data)

@app.put("/profile/me")
def update_my_profile(profile: dict = Body(...), payload=Depends(verify_jwt)):
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Only allow updating specific fields
    allowed_fields = ["full_name", "phone"]
    update_data = {k: v for k, v in profile.items() if k in allowed_fields}
    
    if update_data:
        data = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        return JSONResponse(content=data.data)
    
    return JSONResponse(content=[])

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
@require_debug_mode()
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
@require_debug_mode()
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
@require_debug_mode()
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
        "url": SUPABASE_PUBLIC_URL,
        "publishable_key": os.getenv("SUPABASE_ANON_KEY")
    }

# Credit Notes endpoints
@app.get("/credit-notes")
def get_credit_notes(payload=Depends(require_permission("credit_notes_view"))):
    # Join with customers to get customer names
    data = supabase.table("credit_notes").select("*, customers(*)").execute()
    # Transform to camelCase
    transformed_data = [to_camel_case_credit_note(credit_note) for credit_note in data.data]
    return JSONResponse(content=transformed_data)

@app.get("/credit-notes/{credit_note_id}")
def get_credit_note(credit_note_id: str, payload=Depends(require_permission("credit_notes_view"))):
    # Get credit note with customer and items
    cn_data = supabase.table("credit_notes").select("*, customers(*)").eq("id", credit_note_id).execute()
    if not cn_data.data:
        return JSONResponse(content={"error": "Credit note not found"}, status_code=404)
    
    # Get items for this credit note
    items_data = supabase.table("credit_note_items").select("*, products(*)").eq("credit_note_id", credit_note_id).execute()
    
    # Transform credit note
    credit_note = to_camel_case_credit_note(cn_data.data[0])
    credit_note["items"] = [to_camel_case_credit_note_item(item) for item in items_data.data]
    
    return JSONResponse(content=credit_note)

@app.post("/credit-notes")
def create_credit_note(credit_note: dict = Body(...), payload=Depends(require_permission("credit_notes_create"))):
    # Map camelCase to snake_case
    credit_note_data = {
        "credit_note_number": credit_note["creditNoteNumber"],
        "sales_order_id": credit_note.get("salesOrderId"),
        "invoice_id": credit_note.get("invoiceId"),  # NEW: Add invoice_id support
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
        "rounding_adjustment": credit_note.get("roundingAdjustment", 0), # Added
        "refund_method": credit_note.get("refundMethod", "credit_account"),
        "affects_inventory": credit_note.get("affectsInventory", True),
        "credit_note_type": credit_note.get("creditNoteType", "invoice_linked"),  # NEW: Add credit_note_type
        "notes": credit_note.get("notes"),
        "internal_notes": credit_note.get("internalNotes"),
        "created_by": payload.get("sub")  # Use the current user's ID
    }
    
    # Validate invoice_id is provided for invoice_linked credit notes
    if credit_note_data["credit_note_type"] == "invoice_linked" and not credit_note_data["invoice_id"]:
        raise HTTPException(status_code=400, detail="invoice_id is required for invoice_linked credit notes")
    
    # Create the credit note
    data = supabase.table("credit_notes").insert(credit_note_data).execute()
    created_credit_note = data.data[0] if data.data else None
    
    if not created_credit_note:
        raise HTTPException(status_code=500, detail="Failed to create credit note")
    
    # Insert items if they exist
    items = credit_note.get("items", [])
    if items and len(items) > 0:
        items_data = []
        for item in items:
            item_data = {
                "credit_note_id": created_credit_note["id"],
                "product_id": item["productId"],
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "credit_quantity": item["quantity"],  # Use credit_quantity field
                "unit_price": item["unitPrice"],
                "discount": item.get("discount", 0),
                "tax": item.get("tax", 0),
                "sale_tax_type": item.get("saleTaxType", "exclusive"), # Added
                "unit_abbreviation": item.get("unitAbbreviation", ""), # Added
                "created_by": payload["sub"]
            }
            items_data.append(item_data)
        
        # Insert all items
        if items_data:
            supabase.table("credit_note_items").insert(items_data).execute()
    
    return JSONResponse(content=created_credit_note)

@app.put("/credit-notes/{credit_note_id}")
def update_credit_note(credit_note_id: str, credit_note: dict = Body(...), payload=Depends(require_permission("credit_notes_edit"))):
    # Get current credit note status for validation
    current_credit_note_data = supabase.table("credit_notes").select("status").eq("id", credit_note_id).execute()
    if not current_credit_note_data.data:
        raise HTTPException(status_code=404, detail="Credit note not found")
    
    current_status = current_credit_note_data.data[0]["status"]
    
    # Validate status transition
    validate_credit_note_status_transition(current_status, operation="edit")
    
    # Map camelCase to snake_case
    credit_note_data = {
        "credit_note_number": credit_note["creditNoteNumber"],
        "sales_order_id": credit_note.get("salesOrderId"),
        "invoice_id": credit_note.get("invoiceId"),  # NEW: Add invoice_id support
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
        "rounding_adjustment": credit_note.get("roundingAdjustment", 0), # Added
        "refund_method": credit_note.get("refundMethod", "credit_account"),
        "affects_inventory": credit_note.get("affectsInventory", True),
        "credit_note_type": credit_note.get("creditNoteType", "invoice_linked"),  # NEW: Add credit_note_type
        "notes": credit_note.get("notes"),
        "internal_notes": credit_note.get("internalNotes")
    }
    
    # Validate invoice_id is provided for invoice_linked credit notes
    if credit_note_data["credit_note_type"] == "invoice_linked" and not credit_note_data["invoice_id"]:
        raise HTTPException(status_code=400, detail="invoice_id is required for invoice_linked credit notes")
    
    # Update the credit note
    data = supabase.table("credit_notes").update(credit_note_data).eq("id", credit_note_id).execute()
    updated_credit_note = data.data[0] if data.data else None
    
    if not updated_credit_note:
        raise HTTPException(status_code=404, detail="Credit note not found")
    
    # Handle items update
    items = credit_note.get("items", [])
    if items:
        # Delete existing items
        supabase.table("credit_note_items").delete().eq("credit_note_id", credit_note_id).execute()
        
        # Insert new items
        items_data = []
        for item in items:
            item_data = {
                "credit_note_id": credit_note_id,
                "product_id": item["productId"],
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "credit_quantity": item["quantity"],  # Use credit_quantity field
                "unit_price": item["unitPrice"],
                "discount": item.get("discount", 0),
                "tax": item.get("tax", 0),
                "sale_tax_type": item.get("saleTaxType", "exclusive"), # Added
                "unit_abbreviation": item.get("unitAbbreviation", ""), # Added
                "created_by": payload["sub"]
            }
            items_data.append(item_data)
        
        if items_data:
            supabase.table("credit_note_items").insert(items_data).execute()
    
    return JSONResponse(content=updated_credit_note)

@app.delete("/credit-notes/{credit_note_id}")
def delete_credit_note(credit_note_id: str, payload=Depends(require_permission("credit_notes_delete"))):
    # Get current credit note status for validation
    current_credit_note_data = supabase.table("credit_notes").select("status").eq("id", credit_note_id).execute()
    if not current_credit_note_data.data:
        raise HTTPException(status_code=404, detail="Credit note not found")
    
    current_status = current_credit_note_data.data[0]["status"]
    
    # Validate status transition
    validate_credit_note_status_transition(current_status, operation="delete")
    
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
        "product_name": item.get("productName"),
        "sku_code": item.get("skuCode"),
        "hsn_code": item.get("hsnCode"),
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
        "quality_notes": item.get("qualityNotes"),
        "saleTaxType": item.get("saleTaxType", "exclusive"),
        "unitAbbreviation": item.get("unitAbbreviation", ""),
        "created_by": payload["sub"]
    }
    data = supabase.table("credit_note_items").insert(item_data).execute()
    return JSONResponse(content=data.data)

@app.put("/credit-notes/items/{item_id}")
def update_credit_note_item(item_id: str, item: dict = Body(...), payload=Depends(require_permission("credit_notes_edit"))):
    # Map camelCase to snake_case
    item_data = {
        "product_id": item["productId"],
        "product_name": item.get("productName"),
        "sku_code": item.get("skuCode"),
        "hsn_code": item.get("hsnCode"),
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
        "quality_notes": item.get("qualityNotes"),
        "saleTaxType": item.get("saleTaxType", "exclusive"),
        "unitAbbreviation": item.get("unitAbbreviation", "")
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
        if data.data and len(data.data) > 0:
            settings = [to_camel_case_system_setting(setting) for setting in data.data]
            return JSONResponse(content=settings)
        else:
            # Return default settings only if no settings exist in database
            return JSONResponse(content=get_default_system_settings())
    except Exception as e:
        print(f"Error fetching system settings: {str(e)}")
        # Return default settings on error
        return JSONResponse(content=get_default_system_settings())

@app.get("/public/system-settings")
def get_public_system_settings():
    """Public endpoint for system settings that doesn't require authentication"""
    try:
        # Only return settings where is_public = true
        data = supabase.table("system_settings").select("*").eq("is_public", True).execute()
        if data.data and len(data.data) > 0:
            settings = [to_camel_case_system_setting(setting) for setting in data.data]
            return JSONResponse(content=settings)
        else:
            # Return default public settings only if no public settings exist in database
            return JSONResponse(content=get_default_public_system_settings())
    except Exception as e:
        print(f"Error fetching public system settings: {str(e)}")
        # Return default public settings on error
        return JSONResponse(content=get_default_public_system_settings())

def get_default_public_system_settings():
    """Return default public system settings when database is empty or has errors"""
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
            "id": "default-company-logo-url",
            "key": "company_logo_url",
            "value": "/placeholder.svg",
            "type": "string",
            "description": "Public URL for company logo",
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
            "description": "Default timezone",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-language",
            "key": "language",
            "value": "en",
            "type": "string",
            "description": "Default language",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        },
        {
            "id": "default-enable-signup",
            "key": "enable_signup",
            "value": True,
            "type": "boolean",
            "description": "Enable user signup feature",
            "isPublic": True,
            "createdAt": None,
            "updatedAt": None
        }
    ]

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
            "id": "default-company-logo-url",
            "key": "company_logo_url",
            "value": "/placeholder.svg",
            "type": "string",
            "description": "Public URL for company logo",
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

# ============================================================
# GST Helpers — Indian tax breakup
# ============================================================

def _determine_gst_type(company_state: str, billing_state: str = "", shipping_state: str = "") -> str:
    """Return 'CGST_SGST' (intra-state) or 'IGST' (inter-state)."""
    cs = (company_state or "").strip().lower()
    party = (billing_state or "").strip().lower() or (shipping_state or "").strip().lower()
    if not cs or not party:
        return "IGST"  # safe default when states unknown
    return "CGST_SGST" if cs == party else "IGST"

def _compute_gst_breakup(tax_amount: float, gst_type: str) -> dict:
    """Return dict with cgst_amount, sgst_amount, igst_amount."""
    tax = float(tax_amount or 0)
    if gst_type == "CGST_SGST":
        half = round(tax / 2, 2)
        return {"cgst_amount": half, "sgst_amount": round(tax - half, 2), "igst_amount": 0.0}
    return {"cgst_amount": 0.0, "sgst_amount": 0.0, "igst_amount": tax}

def _get_company_state() -> str:
    """Fetch company_state from system_settings."""
    try:
        res = supabase.table("system_settings").select("setting_value").eq("setting_key", "company_state").maybe_single().execute()
        raw = res.data.get("setting_value", "") if res.data else ""
        # Values are stored as JSON strings like '"Karnataka"'
        import json as _json
        try:
            return _json.loads(raw) if raw else ""
        except Exception:
            return raw.strip('"') if raw else ""
    except Exception:
        return ""

def _gst_fields_from_row(row: dict) -> dict:
    """Extract GST breakup fields from a DB row."""
    return {
        "gstType": row.get("gst_type", "CGST_SGST"),
        "cgstAmount": float(row.get("cgst_amount") or 0),
        "sgstAmount": float(row.get("sgst_amount") or 0),
        "igstAmount": float(row.get("igst_amount") or 0),
    }

def to_camel_case_purchase_order(purchase_order):
    """Convert purchase order data from snake_case to camelCase"""
    return {
        "id": purchase_order.get("id"),
        "orderNumber": purchase_order.get("order_number"),
        "supplierId": purchase_order.get("supplier_id"),
        "supplier": purchase_order.get("suppliers", {}),
        "orderDate": purchase_order.get("order_date"),
        "expectedDeliveryDate": purchase_order.get("expected_delivery_date"),
        "status": purchase_order.get("status"),
        "subtotal": purchase_order.get("subtotal"),
        "taxAmount": purchase_order.get("tax_amount"),
        "discountAmount": purchase_order.get("discount_amount"),
        "totalAmount": purchase_order.get("total_amount"),
        "roundingAdjustment": purchase_order.get("rounding_adjustment", 0), # Added
        "notes": purchase_order.get("notes"),
        "gstType": purchase_order.get("gst_type", "CGST_SGST"),
        "cgstAmount": float(purchase_order.get("cgst_amount") or 0),
        "sgstAmount": float(purchase_order.get("sgst_amount") or 0),
        "igstAmount": float(purchase_order.get("igst_amount") or 0),
        "createdBy": purchase_order.get("created_by"),
        "createdAt": purchase_order.get("created_at"),
        "updatedAt": purchase_order.get("updated_at")
    }

def to_camel_case_purchase_order_item(item):
    """Convert purchase order item data from snake_case to camelCase"""
    return {
        "id": item.get("id"),
        "purchaseOrderId": item.get("purchase_order_id"),
        "productId": item.get("product_id"),
        "productName": item.get("products", {}).get("name") if item.get("products") else item.get("product_name"),
        "skuCode": item.get("products", {}).get("sku_code") if item.get("products") else item.get("sku_code"),
        "hsnCode": item.get("products", {}).get("hsn_code") if item.get("products") else item.get("hsn_code"),
        "quantity": float(item.get("quantity") or 0),
        "costPrice": float(item.get("cost_price") or 0),
        "discount": float(item.get("discount") or 0),
        "tax": float(item.get("tax") or 0),
        "total": float(item.get("total") or 0),
        "purchaseTaxType": item.get("purchase_tax_type", "exclusive"), # Added
        "unitAbbreviation": item.get("unit_abbreviation", ""), # Added
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
    }

def to_camel_case_purchase_indent(indent):
    """Convert purchase indent data from snake_case to camelCase"""
    if not indent:
        return {}
    return {
        "id": indent.get("id"),
        "indentNumber": indent.get("indent_number"),
        "requesterId": indent.get("requester_id"),
        "requester": indent.get("requester", {}) or {},
        "department": indent.get("department"),
        "requiredDate": indent.get("required_date"),
        "status": indent.get("status"),
        "totalEstimatedValue": float(indent.get("total_estimated_value") or 0),
        "notes": indent.get("notes"),
        "createdAt": indent.get("created_at"),
        "updatedAt": indent.get("updated_at")
    }

def to_camel_case_purchase_indent_item(item):
    """Convert purchase indent item data from snake_case to camelCase"""
    if not item:
        return {}
    return {
        "id": item.get("id"),
        "indentId": item.get("indent_id"),
        "productId": item.get("product_id"),
        "productName": item.get("product", {}).get("name") if item.get("product") else item.get("product_name"),
        "skuCode": item.get("product", {}).get("sku_code") if item.get("product") else item.get("sku_code"),
        "quantity": float(item.get("quantity") or 0),
        "estimatedUnitPrice": float(item.get("estimated_unit_price") or 0),
        "purchaseOrderId": item.get("purchase_order_id"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
    }


# Purchase Orders API endpoints
@app.get("/purchase-orders")
def get_purchase_orders(payload=Depends(require_permission("purchase_orders_view"))):
    # Join with suppliers to get supplier names
    try:
        client = get_supabase_client()
        data = client.table("purchase_orders").select("*, suppliers(*)").execute()
    except (httpx.RemoteProtocolError, httpx.ConnectError):
        client = get_supabase_client()
        data = client.table("purchase_orders").select("*, suppliers(*)").execute()
    
    # Filter out orders that already have GRNs (draft or completed)
    available_orders = []
    for order in data.data:
        # Check if there are any GRNs for this purchase order
        grn_check = client.table("good_receive_notes").select("id, status").eq("purchase_order_id", order["id"]).execute()
        
        # Only include orders that have no GRNs or only cancelled GRNs
        has_active_grns = any(grn["status"] in ["draft", "completed", "partial"] for grn in grn_check.data)
        
        if not has_active_grns:
            available_orders.append(order)
    
    # Transform to camelCase
    transformed_data = [to_camel_case_purchase_order(order) for order in available_orders]
    return JSONResponse(content=transformed_data)

@app.get("/purchase-orders/available")
def get_available_purchase_orders_for_grn(payload=Depends(require_permission("purchase_orders_view"))):
    """Get purchase orders available for GRN creation.
    Includes:
    - Approved POs with no GRNs at all
    - Approved/received POs that have only partial GRNs (not all items fully received)
    Excludes:
    - POs with status 'received' (fully received)
    - Cancelled POs
    """
    try:
        client = get_supabase_client()
        data = client.table("purchase_orders").select("*, suppliers(*)").execute()
    except (httpx.RemoteProtocolError, httpx.ConnectError):
        client = get_supabase_client()
        data = client.table("purchase_orders").select("*, suppliers(*)").execute()

    available_orders = []
    for order in data.data:
        po_status = order.get("status")
        # Only POs that could still need goods received
        if po_status not in ["approved", "partial"]:
            continue

        po_id = order["id"]
        # Get PO items (ordered quantities)
        po_items_res = client.table("purchase_order_items").select("id, quantity").eq("purchase_order_id", po_id).execute()
        po_items = po_items_res.data or []
        if not po_items:
            continue  # No items means nothing to receive

        # Get all completed/received GRNs for this PO
        grn_res = client.table("good_receive_notes").select("id, status").eq("purchase_order_id", po_id).execute()
        completed_grn_ids = [
            g["id"] for g in (grn_res.data or [])
            if g.get("status") in ["received", "completed"]
        ]

        # Sum accepted quantities per PO item across completed GRNs
        received_by_item = {}
        if completed_grn_ids:
            grn_items_res = client.table("good_receive_note_items") \
                .select("purchase_order_item_id, accepted_quantity, received_quantity") \
                .in_("grn_id", completed_grn_ids).execute()
            for row in (grn_items_res.data or []):
                poi_id = row.get("purchase_order_item_id")
                if poi_id:
                    # Use accepted_quantity if set (post-QC), else received_quantity
                    qty = int(row.get("accepted_quantity") or row.get("received_quantity") or 0)
                    received_by_item[poi_id] = received_by_item.get(poi_id, 0) + qty

        # Check if any item still has remaining quantity to receive
        has_remaining = any(
            int(poi.get("quantity") or 0) > received_by_item.get(poi["id"], 0)
            for poi in po_items
        )

        if has_remaining:
            available_orders.append(order)

    transformed = [to_camel_case_purchase_order(po) for po in available_orders]
    return JSONResponse(content=transformed)


@app.get("/purchase-orders/{purchase_order_id}/remaining-items")
def get_purchase_order_remaining_items(purchase_order_id: str, payload=Depends(require_permission("purchase_orders_view"))):
    """Return PO items enriched with already-received and remaining quantities.

    Each item includes:
      - orderedQuantity  : quantity on the original PO line
      - alreadyReceived  : sum of accepted/received qty across all completed GRNs
      - remainingQty     : orderedQuantity - alreadyReceived  (>= 0)
    """
    try:
        fresh = get_supabase_client()

        # Fetch PO items with product details
        items_res = fresh.table("purchase_order_items") \
            .select("*, products(*)") \
            .eq("purchase_order_id", purchase_order_id).execute()
        po_items = items_res.data or []

        # Get completed GRNs for this PO
        grn_res = fresh.table("good_receive_notes") \
            .select("id, status") \
            .eq("purchase_order_id", purchase_order_id).execute()
        completed_grn_ids = [
            g["id"] for g in (grn_res.data or [])
            if g.get("status") in ["received", "completed"]
        ]

        # Sum received qty per PO item
        received_by_item = {}
        if completed_grn_ids:
            grn_items_res = fresh.table("good_receive_note_items") \
                .select("purchase_order_item_id, accepted_quantity, received_quantity") \
                .in_("grn_id", completed_grn_ids).execute()
            for row in (grn_items_res.data or []):
                poi_id = row.get("purchase_order_item_id")
                if poi_id:
                    qty = int(row.get("accepted_quantity") or row.get("received_quantity") or 0)
                    received_by_item[poi_id] = received_by_item.get(poi_id, 0) + qty

        # Build enriched response
        result = []
        for item in po_items:
            ordered = int(item.get("quantity") or 0)
            already = received_by_item.get(item["id"], 0)
            remaining = max(0, ordered - already)

            product = item.get("products") or {}
            result.append({
                "id": item["id"],
                "productId": item.get("product_id"),
                "productName": item.get("product_name") or product.get("name", ""),
                "skuCode": item.get("sku_code") or product.get("sku_code", ""),
                "hsnCode": item.get("hsn_code") or product.get("hsn_code", ""),
                "orderedQuantity": ordered,
                "alreadyReceived": already,
                "remainingQty": remaining,
                "costPrice": float(item.get("unit_cost") or item.get("cost_price") or 0),
                "discount": float(item.get("discount") or 0),
                "tax": float(item.get("tax") or 0),
                "purchaseTaxType": item.get("purchase_tax_type") or product.get("purchase_tax_type", "exclusive"),
                "unitAbbreviation": item.get("unit_abbreviation") or "",
            })

        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching remaining items: {str(e)}")



@app.get("/purchase-orders/{purchase_order_id}")
def get_purchase_order(purchase_order_id: str, payload=Depends(require_permission("purchase_orders_view"))):
    try:
        # Use a fresh Supabase client to avoid connection issues
        fresh_supabase = get_supabase_client()
        # Get purchase order with supplier and items
        po_data = fresh_supabase.table("purchase_orders").select("*, suppliers(*)").eq("id", purchase_order_id).execute()
        if not po_data.data:
            return JSONResponse(content={"error": "Purchase order not found"}, status_code=404)
        
        # Get items for this purchase order
        items_data = fresh_supabase.table("purchase_order_items").select("*, products(*)").eq("purchase_order_id", purchase_order_id).execute()
        
        # Transform purchase order
        purchase_order = to_camel_case_purchase_order(po_data.data[0])
        purchase_order["items"] = [to_camel_case_purchase_order_item(item) for item in items_data.data]
        
        return JSONResponse(content=purchase_order)
    except Exception as e:
        print(f"ERROR fetching purchase order {purchase_order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching purchase order: {str(e)}")

@app.get("/purchase-orders/{purchase_order_id}/items")
def get_purchase_order_items(purchase_order_id: str, payload=Depends(require_permission("purchase_orders_view"))):
    # Get items for this purchase order
    data = supabase.table("purchase_order_items").select("*, products(*)").eq("purchase_order_id", purchase_order_id).execute()
    transformed_data = [to_camel_case_purchase_order_item(item) for item in data.data]
    return JSONResponse(content=transformed_data)

@app.post("/purchase-orders")
def create_purchase_order(purchase_order: dict = Body(...), payload=Depends(require_permission("purchase_orders_create"))):
    # Validate status value
    valid_statuses = ["draft", "pending", "approved", "received", "cancelled"]
    status = purchase_order.get("status")
    if status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status}'. Valid statuses are: {valid_statuses}"
        )
    
    # Map camelCase to snake_case
    purchase_order_data = {
        "order_number": purchase_order["orderNumber"],
        "supplier_id": purchase_order["supplierId"],
        "order_date": purchase_order["orderDate"],
        "expected_delivery_date": purchase_order.get("expectedDeliveryDate"),
        "status": status,
        "subtotal": purchase_order["subtotal"],
        "tax_amount": purchase_order["taxAmount"],
        "discount_amount": purchase_order["discountAmount"],
        "total_amount": purchase_order["totalAmount"],
        "rounding_adjustment": purchase_order.get("roundingAdjustment", 0),
        "notes": purchase_order.get("notes"),
        "gst_type": purchase_order.get("gstType", "IGST"),
        "cgst_amount": purchase_order.get("cgstAmount", 0),
        "sgst_amount": purchase_order.get("sgstAmount", 0),
        "igst_amount": purchase_order.get("igstAmount", 0),
        "created_by": payload["sub"]
    }
    
    # Create the purchase order
    data = supabase.table("purchase_orders").insert(purchase_order_data).execute()
    created_purchase_order = data.data[0] if data.data else None
    
    if not created_purchase_order:
        raise HTTPException(status_code=500, detail="Failed to create purchase order")
    
    # Insert items if they exist
    items = purchase_order.get("items", [])
    if items and len(items) > 0:
        items_data = []
        for item in items:
            item_data = {
                "purchase_order_id": created_purchase_order["id"],
                "product_id": item["productId"],
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "quantity": item["quantity"],
                "cost_price": item["costPrice"],
                "discount": item["discount"],
                "tax": item["tax"],
                "purchase_tax_type": item.get("purchaseTaxType", "exclusive"),
                "unit_abbreviation": item.get("unitAbbreviation", ""),
                "created_by": payload["sub"]
            }
            items_data.append(item_data)
        
        # Insert all items
        if items_data:
            supabase.table("purchase_order_items").insert(items_data).execute()
    
    return JSONResponse(content=created_purchase_order)

@app.put("/purchase-orders/{purchase_order_id}")
def update_purchase_order(purchase_order_id: str, purchase_order: dict = Body(...), payload=Depends(require_permission("purchase_orders_edit"))):
    # Get current purchase order status for validation
    current_order_data = supabase.table("purchase_orders").select("status").eq("id", purchase_order_id).execute()
    if not current_order_data.data:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    current_status = current_order_data.data[0]["status"]
    
    # Validate status transition
    validate_purchase_order_status_transition(current_status, operation="edit")
    
    print(f"DEBUG: Received purchase order update request with status: {purchase_order.get('status')}")
    # Validate status value
    valid_statuses = ["draft", "pending", "approved", "received", "cancelled"]
    status = purchase_order.get("status")
    print(f"DEBUG: Validating status '{status}' against valid_statuses: {valid_statuses}")
    if status not in valid_statuses:
        print(f"DEBUG: Invalid status '{status}' detected, raising HTTPException")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status}'. Valid statuses are: {valid_statuses}"
        )
    print(f"DEBUG: Status validation passed, proceeding with update")
    
    # Map camelCase to snake_case
    purchase_order_data = {
        "order_number": purchase_order["orderNumber"],
        "supplier_id": purchase_order["supplierId"],
        "order_date": purchase_order["orderDate"],
        "expected_delivery_date": purchase_order.get("expectedDeliveryDate"),
        "status": status,
        "subtotal": purchase_order["subtotal"],
        "tax_amount": purchase_order["taxAmount"],
        "discount_amount": purchase_order["discountAmount"],
        "total_amount": purchase_order["totalAmount"],
        "rounding_adjustment": purchase_order.get("roundingAdjustment", 0),
        "notes": purchase_order.get("notes"),
        "gst_type": purchase_order.get("gstType", "IGST"),
        "cgst_amount": purchase_order.get("cgstAmount", 0),
        "sgst_amount": purchase_order.get("sgstAmount", 0),
        "igst_amount": purchase_order.get("igstAmount", 0),
    }
    
    # Update the purchase order
    data = supabase.table("purchase_orders").update(purchase_order_data).eq("id", purchase_order_id).execute()
    updated_purchase_order = data.data[0] if data.data else None
    
    if not updated_purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Handle items update
    items = purchase_order.get("items", [])
    if items is not None:  # Only update items if they are provided
        # First, delete existing items
        supabase.table("purchase_order_items").delete().eq("purchase_order_id", purchase_order_id).execute()
        
        # Then insert new items if they exist
        if len(items) > 0:
            items_data = []
            for item in items:
                item_data = {
                    "purchase_order_id": purchase_order_id,
                    "product_id": item["productId"],
                    "product_name": item["productName"],
                    "sku_code": item["skuCode"],
                    "hsn_code": item["hsnCode"],
                    "quantity": item["quantity"],
                    "cost_price": item["costPrice"],
                    "discount": item["discount"],
                    "tax": item["tax"],
                    "purchase_tax_type": item.get("purchaseTaxType", "exclusive"),
                    "unit_abbreviation": item.get("unitAbbreviation", ""),
                    "created_by": payload["sub"]
                }
                items_data.append(item_data)
            
            # Insert all items
            if items_data:
                supabase.table("purchase_order_items").insert(items_data).execute()
    
    return JSONResponse(content=updated_purchase_order)

@app.delete("/purchase-orders/{purchase_order_id}")
def delete_purchase_order(purchase_order_id: str, payload=Depends(require_permission("purchase_orders_delete"))):
    # Get current purchase order status for validation
    current_order_data = supabase.table("purchase_orders").select("status").eq("id", purchase_order_id).execute()
    if not current_order_data.data:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    current_status = current_order_data.data[0]["status"]
    
    # Validate status transition
    validate_purchase_order_status_transition(current_status, operation="delete")
    
    data = supabase.table("purchase_orders").delete().eq("id", purchase_order_id).execute()
    return JSONResponse(content=data.data)

def to_camel_case_sales_order(sales_order):
    """Convert sales order data from snake_case to camelCase"""
    return {
        "id": sales_order.get("id"),
        "orderNumber": sales_order.get("order_number"),
        "customerPoNumber": sales_order.get("customer_po_number"),
        "customerId": sales_order.get("customer_id"),
        "customer": sales_order.get("customers", {}),
        "billingAddress": sales_order.get("billing_address"),
        "shippingAddress": sales_order.get("shipping_address"),
        "orderDate": sales_order.get("order_date"),
        "dueDate": sales_order.get("due_date"),
        "status": sales_order.get("status"),
        "subtotal": sales_order.get("subtotal"),
        "taxAmount": sales_order.get("tax_amount"),
        "discountAmount": sales_order.get("discount_amount"),
        "totalAmount": sales_order.get("total_amount"),
        "roundingAdjustment": sales_order.get("rounding_adjustment", 0), # Added
        "notes": sales_order.get("notes"),
        "gstType": sales_order.get("gst_type", "CGST_SGST"),
        "cgstAmount": float(sales_order.get("cgst_amount") or 0),
        "sgstAmount": float(sales_order.get("sgst_amount") or 0),
        "igstAmount": float(sales_order.get("igst_amount") or 0),
        "createdBy": sales_order.get("created_by"),
        "createdAt": sales_order.get("created_at"),
        "updatedAt": sales_order.get("updated_at")
    }

def to_camel_case_sales_order_item(item):
    """Convert sales order item data from snake_case to camelCase"""
    return {
        "id": item.get("id"),
        "salesOrderId": item.get("sales_order_id"),
        "productId": item.get("product_id"),
        "productName": item.get("products", {}).get("name") if item.get("products") else item.get("product_name"),
        "skuCode": item.get("products", {}).get("sku_code") if item.get("products") else item.get("sku_code"),
        "hsnCode": item.get("products", {}).get("hsn_code") if item.get("products") else item.get("hsn_code"),
        "quantity": item.get("quantity"),
        "unitPrice": item.get("unit_price"),
        "discount": item.get("discount"),
        "tax": item.get("tax"),
        "total": item.get("total"),
        "saleTaxType": item.get("sale_tax_type", "exclusive"), # Added
        "unitAbbreviation": item.get("unit_abbreviation", ""), # Added
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
    }

# Sales Orders API endpoints

# ============================================================
# Sale Quotations API
# ============================================================

TERMINAL_QUOTATION_STATUSES = ["accepted", "rejected", "expired", "cancelled"]

def to_camel_case_sale_quotation(q):
    """Convert sale_quotation row from snake_case to camelCase."""
    if not q:
        return {}
    return {
        "id": q.get("id"),
        "quotationNumber": q.get("quotation_number"),
        "customerId": q.get("customer_id"),
        "customer": q.get("customers", {}),
        "billingAddress": q.get("billing_address"),
        "shippingAddress": q.get("shipping_address"),
        "quotationDate": q.get("quotation_date"),
        "validUntil": q.get("valid_until"),
        "status": q.get("status"),
        "subtotal": float(q.get("subtotal") or 0),
        "taxAmount": float(q.get("tax_amount") or 0),
        "discountAmount": float(q.get("discount_amount") or 0),
        "totalAmount": float(q.get("total_amount") or 0),
        "roundingAdjustment": float(q.get("rounding_adjustment") or 0),
        "gstType": q.get("gst_type", "CGST_SGST"),
        "cgstAmount": float(q.get("cgst_amount") or 0),
        "sgstAmount": float(q.get("sgst_amount") or 0),
        "igstAmount": float(q.get("igst_amount") or 0),
        "notes": q.get("notes"),
        "termsConditions": q.get("terms_conditions"),
        "salesOrderId": q.get("sales_order_id"),
        "createdBy": q.get("created_by"),
        "createdAt": q.get("created_at"),
        "updatedAt": q.get("updated_at"),
    }

def to_camel_case_sale_quotation_item(item):
    """Convert sale_quotation_item row from snake_case to camelCase."""
    if not item:
        return {}
    return {
        "id": item.get("id"),
        "quotationId": item.get("quotation_id"),
        "productId": item.get("product_id"),
        "productName": item.get("products", {}).get("name") if item.get("products") else item.get("product_name"),
        "skuCode": item.get("products", {}).get("sku_code") if item.get("products") else item.get("sku_code"),
        "hsnCode": item.get("products", {}).get("hsn_code") if item.get("products") else item.get("hsn_code"),
        "quantity": float(item.get("quantity") or 0),
        "unitPrice": float(item.get("unit_price") or 0),
        "discount": float(item.get("discount") or 0),
        "tax": float(item.get("tax") or 0),
        "saleTaxType": item.get("sale_tax_type", "exclusive"),
        "unitAbbreviation": item.get("unit_abbreviation", ""),
        "total": float(item.get("total") or 0),
        "createdAt": item.get("created_at"),
    }

def _auto_expire_quotation(q: dict) -> dict:
    """If a 'sent' quotation's valid_until is in the past, flag it as expired in-memory."""
    from datetime import date as _date
    if q.get("status") == "sent" and q.get("valid_until"):
        try:
            valid_until = _date.fromisoformat(str(q["valid_until"]))
            if valid_until < _date.today():
                q["status"] = "expired"
        except Exception:
            pass
    return q

def _insert_quotation_items(client, quotation_id: str, items: list, created_by: str):
    """Helper to bulk-insert quotation items."""
    if not items:
        return
    items_data = []
    for item in items:
        items_data.append({
            "quotation_id": quotation_id,
            "product_id": item.get("productId"),
            "product_name": item.get("productName", ""),
            "sku_code": item.get("skuCode", ""),
            "hsn_code": item.get("hsnCode", ""),
            "quantity": item.get("quantity", 0),
            "unit_price": item.get("unitPrice", 0),
            "discount": item.get("discount", 0),
            "tax": item.get("tax", 0),
            "sale_tax_type": item.get("saleTaxType", "exclusive"),
            "unit_abbreviation": item.get("unitAbbreviation", ""),
            "total": item.get("total", 0),
        })
    client.table("sale_quotations").select("id").eq("id", quotation_id).execute()  # confirm exists
    client.table("sale_quotation_items").insert(items_data).execute()

@app.get("/sale-quotations")
def get_sale_quotations(payload=Depends(require_permission("sale_quotations_view"))):
    """List all sale quotations."""
    client = get_supabase_client()
    data = client.table("sale_quotations").select("*, customers(*)").order("created_at", desc=True).execute()
    result = [to_camel_case_sale_quotation(_auto_expire_quotation(q)) for q in (data.data or [])]
    return JSONResponse(content=result)

@app.get("/sale-quotations/{quotation_id}")
def get_sale_quotation(quotation_id: str, payload=Depends(require_permission("sale_quotations_view"))):
    """Get a single sale quotation with its items."""
    client = get_supabase_client()
    q_data = client.table("sale_quotations").select("*, customers(*)").eq("id", quotation_id).execute()
    if not q_data.data:
        raise HTTPException(status_code=404, detail="Quotation not found")
    q = _auto_expire_quotation(q_data.data[0])
    quotation = to_camel_case_sale_quotation(q)
    items_data = client.table("sale_quotation_items").select("*, products(*)").eq("quotation_id", quotation_id).execute()
    quotation["items"] = [to_camel_case_sale_quotation_item(i) for i in (items_data.data or [])]
    return JSONResponse(content=quotation)

@app.get("/sale-quotations/{quotation_id}/items")
def get_sale_quotation_items(quotation_id: str, payload=Depends(require_permission("sale_quotations_view"))):
    client = get_supabase_client()
    data = client.table("sale_quotation_items").select("*, products(*)").eq("quotation_id", quotation_id).execute()
    return JSONResponse(content=[to_camel_case_sale_quotation_item(i) for i in (data.data or [])])

@app.post("/sale-quotations")
def create_sale_quotation(quotation: dict = Body(...), payload=Depends(require_permission("sale_quotations_create"))):
    """Create a new sale quotation."""
    valid_statuses = ["draft", "sent", "rejected", "cancelled"]
    status = quotation.get("status", "draft")
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status}'. Valid: {valid_statuses}")

    client = get_supabase_client()
    q_data = {
        "quotation_number": quotation["quotationNumber"],
        "customer_id": quotation["customerId"],
        "billing_address": quotation.get("billingAddress"),
        "shipping_address": quotation.get("shippingAddress"),
        "quotation_date": quotation.get("quotationDate", str(__import__("datetime").date.today())),
        "valid_until": quotation.get("validUntil"),
        "status": status,
        "subtotal": quotation.get("subtotal", 0),
        "tax_amount": quotation.get("taxAmount", 0),
        "discount_amount": quotation.get("discountAmount", 0),
        "total_amount": quotation.get("totalAmount", 0),
        "rounding_adjustment": quotation.get("roundingAdjustment", 0),
        "notes": quotation.get("notes"),
        "terms_conditions": quotation.get("termsConditions"),
        "gst_type": quotation.get("gstType", "IGST"),
        "cgst_amount": quotation.get("cgstAmount", 0),
        "sgst_amount": quotation.get("sgstAmount", 0),
        "igst_amount": quotation.get("igstAmount", 0),
        "created_by": payload["sub"],
    }

    result = client.table("sale_quotations").insert(q_data).execute()
    created = result.data[0] if result.data else None
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create quotation")

    # Insert items
    items = quotation.get("items", [])
    if items:
        items_data = []
        for item in items:
            items_data.append({
                "quotation_id": created["id"],
                "product_id": item.get("productId"),
                "product_name": item.get("productName", ""),
                "sku_code": item.get("skuCode", ""),
                "hsn_code": item.get("hsnCode", ""),
                "quantity": item.get("quantity", 0),
                "unit_price": item.get("unitPrice", 0),
                "discount": item.get("discount", 0),
                "tax": item.get("tax", 0),
                "sale_tax_type": item.get("saleTaxType", "exclusive"),
                "unit_abbreviation": item.get("unitAbbreviation", ""),
                "total": item.get("total", 0),
            })
        client.table("sale_quotation_items").insert(items_data).execute()

    return JSONResponse(content=to_camel_case_sale_quotation(created))

@app.put("/sale-quotations/{quotation_id}")
def update_sale_quotation(quotation_id: str, quotation: dict = Body(...), payload=Depends(require_permission("sale_quotations_edit"))):
    """Update a sale quotation. Blocked for accepted/expired/rejected/cancelled."""
    client = get_supabase_client()
    current = client.table("sale_quotations").select("*").eq("id", quotation_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Quotation not found")

    current_q = current.data[0]
    current_status = current_q["status"]
    if current_status in TERMINAL_QUOTATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot edit quotation with status '{current_status}'")

    valid_statuses = ["draft", "sent", "rejected", "cancelled"]
    new_status = quotation.get("status", current_status)
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{new_status}'. Valid: {valid_statuses}")

    q_data = {
        "quotation_number": quotation.get("quotationNumber", current_q["quotation_number"]),
        "customer_id": quotation["customerId"],
        "billing_address": quotation.get("billingAddress"),
        "shipping_address": quotation.get("shippingAddress"),
        "quotation_date": quotation.get("quotationDate", current_q["quotation_date"]),
        "valid_until": quotation.get("validUntil"),
        "status": new_status,
        "subtotal": quotation.get("subtotal", 0),
        "tax_amount": quotation.get("taxAmount", 0),
        "discount_amount": quotation.get("discountAmount", 0),
        "total_amount": quotation.get("totalAmount", 0),
        "rounding_adjustment": quotation.get("roundingAdjustment", 0),
        "notes": quotation.get("notes"),
        "terms_conditions": quotation.get("termsConditions"),
        "gst_type": quotation.get("gstType", "IGST"),
        "cgst_amount": quotation.get("cgstAmount", 0),
        "sgst_amount": quotation.get("sgstAmount", 0),
        "igst_amount": quotation.get("igstAmount", 0),
    }

    result = client.table("sale_quotations").update(q_data).eq("id", quotation_id).execute()
    updated = result.data[0] if result.data else None
    if not updated:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Replace items
    items = quotation.get("items")
    if items is not None:
        client.table("sale_quotation_items").delete().eq("quotation_id", quotation_id).execute()
        if items:
            items_data = []
            for item in items:
                items_data.append({
                    "quotation_id": quotation_id,
                    "product_id": item.get("productId"),
                    "product_name": item.get("productName", ""),
                    "sku_code": item.get("skuCode", ""),
                    "hsn_code": item.get("hsnCode", ""),
                    "quantity": item.get("quantity", 0),
                    "unit_price": item.get("unitPrice", 0),
                    "discount": item.get("discount", 0),
                    "tax": item.get("tax", 0),
                    "sale_tax_type": item.get("saleTaxType", "exclusive"),
                    "unit_abbreviation": item.get("unitAbbreviation", ""),
                    "total": item.get("total", 0),
                })
            client.table("sale_quotation_items").insert(items_data).execute()

    return JSONResponse(content=to_camel_case_sale_quotation(updated))

@app.delete("/sale-quotations/{quotation_id}")
def delete_sale_quotation(quotation_id: str, payload=Depends(require_permission("sale_quotations_delete"))):
    """Delete a quotation. Blocked for terminal statuses."""
    client = get_supabase_client()
    current = client.table("sale_quotations").select("status").eq("id", quotation_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Quotation not found")

    current_status = current.data[0]["status"]
    if current_status in TERMINAL_QUOTATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot delete quotation with status '{current_status}'")

    client.table("sale_quotation_items").delete().eq("quotation_id", quotation_id).execute()
    result = client.table("sale_quotations").delete().eq("id", quotation_id).execute()
    return JSONResponse(content=result.data)

@app.post("/sale-quotations/{quotation_id}/convert-to-order")
def convert_quotation_to_order(quotation_id: str, payload=Depends(require_permission("sale_quotations_edit"))):
    """
    Convert an accepted/sent quotation into a Sale Order.
    - Marks quotation status = 'accepted' (read-only)
    - Stores the resulting sales_order_id on the quotation
    - Returns the created sales order
    """
    try:
        import datetime as _dt
        # Fetch quotation + items
        q_data = supabase.table("sale_quotations").select("*").eq("id", quotation_id).execute()
        if not q_data.data:
            raise HTTPException(status_code=404, detail="Quotation not found")
        q = q_data.data[0]

        if q.get("status") not in ["sent", "accepted"]:
            raise HTTPException(status_code=400, detail=f"Cannot convert quotation with status '{q.get('status')}'. Only 'sent' quotations can be converted.")

        if q.get("sales_order_id"):
            # If already converted, just return the existing SO
            so_data = supabase.table("sales_orders").select("*").eq("id", q.get("sales_order_id")).execute()
            if so_data.data:
                return JSONResponse(content=to_camel_case_sales_order(so_data.data[0]))
            # If pointer exists but SO is gone, we allow re-conversion attempt
            pass

        items_data = supabase.table("sale_quotation_items").select("*").eq("quotation_id", quotation_id).execute()
        items = items_data.data or []

        # Build SO number based on QTN number
        q_number = q.get("quotation_number") or f"QTN-{quotation_id[:8]}"
        so_number = q_number.replace("QTN-", "SO-")

        so_row = {
            "order_number": so_number,
            "customer_id": q.get("customer_id"),
            "billing_address": q.get("billing_address"),
            "shipping_address": q.get("shipping_address"),
            "order_date": str(_dt.date.today()),
            "due_date": str(_dt.date.today() + _dt.timedelta(days=7)),
            "status": "draft",
            "subtotal": float(q.get("subtotal") or 0),
            "tax_amount": float(q.get("tax_amount") or 0),
            "discount_amount": float(q.get("discount_amount") or 0),
            "total_amount": float(q.get("total_amount") or 0),
            "rounding_adjustment": float(q.get("rounding_adjustment") or 0),
            "gst_type": q.get("gst_type", "IGST"),
            "cgst_amount": float(q.get("cgst_amount") or 0),
            "sgst_amount": float(q.get("sgst_amount") or 0),
            "igst_amount": float(q.get("igst_amount") or 0),
            "notes": f"Generated from Quotation {q_number}",
            "created_by": payload["sub"],
        }

        so_result = supabase.table("sales_orders").insert(so_row).execute()
        if not so_result.data:
            raise Exception("Sales Order insertion failed - no data returned")
        
        created_so = so_result.data[0]

        # Copy items to SO
        if items:
            so_items = []
            for item in items:
                so_items.append({
                    "sales_order_id": created_so["id"],
                    "product_id": item.get("product_id"),
                    "product_name": item.get("product_name", ""),
                    "sku_code": item.get("sku_code", ""),
                    "hsn_code": item.get("hsn_code", ""),
                    "quantity": int(float(item.get("quantity", 0))), # Must be int for sales_order_items
                    "unit_price": float(item.get("unit_price", 0)),
                    "discount": float(item.get("discount", 0)),
                    "tax": float(item.get("tax", 0)),
                    "sale_tax_type": item.get("sale_tax_type", "exclusive"),
                    "unit_abbreviation": item.get("unit_abbreviation", ""),
                    # 'total' is a GENERATED column in sales_order_items, OMIT it from insert
                    "created_by": payload["sub"],
                })
            supabase.table("sales_order_items").insert(so_items).execute()

        # Lock quotation as accepted
        supabase.table("sale_quotations").update({
            "status": "accepted",
            "sales_order_id": created_so["id"],
        }).eq("id", quotation_id).execute()

        return JSONResponse(content=to_camel_case_sales_order(created_so))

    except Exception as e:
        print(f"CONVERSION ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

# ============================================================
# Sales Orders API endpoints
# ============================================================

@app.get("/sales-orders")
def get_sales_orders(payload=Depends(require_permission("sale_orders_view"))):
    # Join with customers to get customer names
    data = supabase.table("sales_orders").select("*, customers(*)").execute()
    
    # Transform to camelCase
    transformed_data = [to_camel_case_sales_order(order) for order in data.data]
    return JSONResponse(content=transformed_data)

@app.get("/sales-orders/available")
def get_available_sales_orders_for_invoice(payload=Depends(require_permission("sale_orders_view"))):
    """Get sales orders that are available for invoice creation (no existing invoices)"""
    # Join with customers to get customer names
    data = supabase.table("sales_orders").select("*, customers(*)").execute()
    
    # Filter out orders that already have invoices (draft or sent)
    available_orders = []
    for order in data.data:
        # Only include approved orders (not sent, not cancelled)
        if order["status"] not in ["approved"]:
            continue
            
        # Check if there are any invoices for this sales order
        invoice_check = supabase.table("sale_invoices").select("id, status").eq("sales_order_id", order["id"]).execute()
        
        # Only include orders that have no invoices or only cancelled invoices
        has_active_invoices = any(inv["status"] in ["draft", "sent", "partial", "paid"] for inv in invoice_check.data)
        
        if not has_active_invoices:
            available_orders.append(order)
    
    # Transform to camelCase
    transformed_data = [to_camel_case_sales_order(order) for order in available_orders]
    return JSONResponse(content=transformed_data)

@app.get("/sales-orders/{sales_order_id}")
def get_sales_order(sales_order_id: str, payload=Depends(require_permission("sale_orders_view"))):
    # Get sales order with customer and items
    so_data = supabase.table("sales_orders").select("*, customers(*)").eq("id", sales_order_id).execute()
    if not so_data.data:
        return JSONResponse(content={"error": "Sales order not found"}, status_code=404)
    
    # Get items for this sales order
    items_data = supabase.table("sales_order_items").select("*, products(*)").eq("sales_order_id", sales_order_id).execute()
    
    # Transform sales order
    sales_order = to_camel_case_sales_order(so_data.data[0])
    sales_order["items"] = [to_camel_case_sales_order_item(item) for item in items_data.data]
    
    return JSONResponse(content=sales_order)

@app.get("/sales-orders/{sales_order_id}/items")
def get_sales_order_items(sales_order_id: str, payload=Depends(require_permission("sale_orders_view"))):
    # Get items for this sales order
    data = supabase.table("sales_order_items").select("*, products(*)").eq("sales_order_id", sales_order_id).execute()
    transformed_data = [to_camel_case_sales_order_item(item) for item in data.data]
    return JSONResponse(content=transformed_data)

@app.post("/sales-orders")
def create_sales_order(sales_order: dict = Body(...), payload=Depends(require_permission("sale_orders_create"))):
    # Map camelCase to snake_case
    sales_order_data = {
        "order_number": sales_order["orderNumber"],
        "customer_po_number": sales_order.get("customerPoNumber"),
        "customer_id": sales_order["customerId"],
        "billing_address": sales_order.get("billingAddress"),
        "shipping_address": sales_order.get("shippingAddress"),
        "order_date": sales_order["orderDate"],
        "due_date": sales_order.get("dueDate"),
        "status": sales_order["status"],
        "subtotal": sales_order["subtotal"],
        "tax_amount": sales_order["taxAmount"],
        "discount_amount": sales_order["discountAmount"],
        "total_amount": sales_order["totalAmount"],
        "rounding_adjustment": sales_order.get("roundingAdjustment", 0), # Added
        "notes": sales_order.get("notes"),
        "gst_type": sales_order.get("gstType", "IGST"),
        "cgst_amount": sales_order.get("cgstAmount", 0),
        "sgst_amount": sales_order.get("sgstAmount", 0),
        "igst_amount": sales_order.get("igstAmount", 0),
        "created_by": payload["sub"]
    }
    
    # Create the sales order
    data = supabase.table("sales_orders").insert(sales_order_data).execute()
    created_sales_order = data.data[0] if data.data else None
    
    if not created_sales_order:
        raise HTTPException(status_code=500, detail="Failed to create sales order")
    
    # Insert items if they exist
    items = sales_order.get("items", [])
    if items and len(items) > 0:
        items_data = []
        for item in items:
            item_data = {
                "sales_order_id": created_sales_order["id"],
                "product_id": item["productId"],
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "quantity": item["quantity"],
                "unit_price": item["unitPrice"],
                "discount": item["discount"],
                "tax": item["tax"],
                "sale_tax_type": item.get("saleTaxType", "exclusive"), # Added
                "unit_abbreviation": item.get("unitAbbreviation", ""), # Added
                "created_by": payload["sub"]
            }
            items_data.append(item_data)
        
        # Insert all items
        if items_data:
            supabase.table("sales_order_items").insert(items_data).execute()
    
    return JSONResponse(content=created_sales_order)

@app.put("/sales-orders/{sales_order_id}")
def update_sales_order(sales_order_id: str, sales_order: dict = Body(...), payload=Depends(require_permission("sale_orders_edit"))):
    try:
        # Get current sales order status for validation
        current_order_data = supabase.table("sales_orders").select("status").eq("id", sales_order_id).execute()
        if not current_order_data.data:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        current_status = current_order_data.data[0]["status"]
        
        # Validate status transition
        validate_sales_order_status_transition(current_status, operation="edit")
        
        # Map camelCase to snake_case
        sales_order_data = {
            "order_number": sales_order["orderNumber"],
            "customer_po_number": sales_order.get("customerPoNumber"),
            "customer_id": sales_order["customerId"],
            "billing_address": sales_order.get("billingAddress"),
            "shipping_address": sales_order.get("shippingAddress"),
            "order_date": sales_order["orderDate"],
            "due_date": sales_order.get("dueDate"),
            "status": sales_order["status"],
            "subtotal": sales_order["subtotal"],
            "tax_amount": sales_order["taxAmount"],
            "discount_amount": sales_order["discountAmount"],
            "total_amount": sales_order["totalAmount"],
            "rounding_adjustment": sales_order.get("roundingAdjustment", 0), # Added
            "notes": sales_order.get("notes"),
            "gst_type": sales_order.get("gstType", "IGST"),
            "cgst_amount": sales_order.get("cgstAmount", 0),
            "sgst_amount": sales_order.get("sgstAmount", 0),
            "igst_amount": sales_order.get("igstAmount", 0),
            "created_by": payload["sub"]
        }
        
        # Update the sales order
        data = supabase.table("sales_orders").update(sales_order_data).eq("id", sales_order_id).execute()
        
        # Update items if provided
        items = sales_order.get("items", [])
        if items and len(items) > 0:
            # First, delete existing items
            supabase.table("sales_order_items").delete().eq("sales_order_id", sales_order_id).execute()
            
            # Then insert the updated items
            items_data = []
            for item in items:
                item_data = {
                    "sales_order_id": sales_order_id,
                    "product_id": item["productId"],
                    "product_name": item["productName"],
                    "sku_code": item["skuCode"],
                    "hsn_code": item["hsnCode"],
                    "quantity": int(float(item["quantity"])), # Ensure integer
                    "unit_price": float(item["unitPrice"]),
                    "discount": float(item["discount"]),
                    "tax": float(item["tax"]),
                    "sale_tax_type": item.get("saleTaxType", "exclusive"),
                    "unit_abbreviation": item.get("unitAbbreviation", ""),
                    "created_by": payload["sub"]
                }
                items_data.append(item_data)
            
            # Insert all items
            if items_data:
                supabase.table("sales_order_items").insert(items_data).execute()
        
        return JSONResponse(content=data.data[0])
    except Exception as e:
        print(f"UPDATE SALES ORDER ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/sales-orders/{sales_order_id}")
def delete_sales_order(sales_order_id: str, payload=Depends(require_permission("sale_orders_delete"))):
    # Get current sales order status for validation
    current_order_data = supabase.table("sales_orders").select("status").eq("id", sales_order_id).execute()
    if not current_order_data.data:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    current_status = current_order_data.data[0]["status"]
    
    # Validate status transition
    validate_sales_order_status_transition(current_status, operation="delete")
    
    data = supabase.table("sales_orders").delete().eq("id", sales_order_id).execute()
    return JSONResponse(content=data.data)

def to_camel_case_payment(payment):
    """Convert payment from snake_case to camelCase."""
    if not payment:
        return None
    
    return {
        "id": payment.get("id"),
        "invoiceId": payment.get("invoice_id"),
        "customerId": payment.get("customer_id"),
        "paymentAmount": payment.get("payment_amount"),
        "paymentDate": payment.get("payment_date"),
        "paymentMethod": payment.get("payment_method"),
        "paymentReference": payment.get("payment_reference"),
        "notes": payment.get("notes"),
        "createdAt": payment.get("created_at"),
        "updatedAt": payment.get("updated_at"),
        "createdBy": payment.get("created_by"),
        "updatedBy": payment.get("updated_by")
    }

def to_camel_case_sale_invoice(sale_invoice):
    """Convert sale invoice data from snake_case to camelCase"""
    return {
        "id": sale_invoice.get("id"),
        "invoiceNumber": sale_invoice.get("invoice_number"),
        "customerPoNumber": sale_invoice.get("customer_po_number"),
        "salesOrderId": sale_invoice.get("sales_order_id"),
        "salesOrder": to_camel_case_sales_order(sale_invoice.get("sales_orders", {})) if sale_invoice.get("sales_orders") else None,
        "customerId": sale_invoice.get("customer_id"),
        "customer": sale_invoice.get("customers", {}),
        "billingAddress": sale_invoice.get("billing_address"),
        "shippingAddress": sale_invoice.get("shipping_address"),
        "invoiceDate": sale_invoice.get("invoice_date"),
        "dueDate": sale_invoice.get("due_date"),
        "status": sale_invoice.get("status"),
        "subtotal": sale_invoice.get("subtotal"),
        "taxAmount": sale_invoice.get("tax_amount"),
        "discountAmount": sale_invoice.get("discount_amount"),
        "totalAmount": sale_invoice.get("total_amount"),
        "amountPaid": sale_invoice.get("amount_paid", 0),  # Added for payment tracking
        "amountDue": sale_invoice.get("amount_due", 0),    # Added for payment tracking
        "roundingAdjustment": sale_invoice.get("rounding_adjustment", 0), # Added
        "gstType": sale_invoice.get("gst_type", "CGST_SGST"),
        "cgstAmount": float(sale_invoice.get("cgst_amount") or 0),
        "sgstAmount": float(sale_invoice.get("sgst_amount") or 0),
        "igstAmount": float(sale_invoice.get("igst_amount") or 0),
        "isDirect": sale_invoice.get("is_direct", False), # Added
        "notes": sale_invoice.get("notes"),
        "createdBy": sale_invoice.get("created_by"),
        "createdAt": sale_invoice.get("created_at"),
        "updatedAt": sale_invoice.get("updated_at")
    }

def to_camel_case_sale_invoice_item(item):
    """Convert sale invoice item data from snake_case to camelCase"""
    return {
        "id": item.get("id"),
        "saleInvoiceId": item.get("invoice_id"),
        "productId": item.get("product_id"),
        "productName": item.get("products", {}).get("name") if item.get("products") else item.get("product_name"),
        "skuCode": item.get("products", {}).get("sku_code") if item.get("products") else item.get("sku_code"),
        "hsnCode": item.get("products", {}).get("hsn_code") if item.get("products") else item.get("hsn_code"),
        "quantity": item.get("quantity"),
        "unitPrice": item.get("unit_price"),
        "discount": item.get("discount"),
        "tax": item.get("tax"),
        "total": item.get("total"),
        "saleTaxType": item.get("sale_tax_type", "exclusive"), # Added
        "unitAbbreviation": item.get("unit_abbreviation", ""), # Added
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
    }

# Sale Invoices API endpoints
@app.get("/sale-invoices")
def get_sale_invoices(payload=Depends(require_permission("sale_invoices_view"))):
    # Join with customers to get customer names
    data = supabase.table("sale_invoices").select("*, customers(*)").execute()
    # Transform to camelCase
    transformed_data = [to_camel_case_sale_invoice(invoice) for invoice in data.data]
    return JSONResponse(content=transformed_data)

@app.get("/sale-invoices/{sale_invoice_id}")
def get_sale_invoice(sale_invoice_id: str, payload=Depends(require_permission("sale_invoices_view"))):
    # Get sale invoice with customer and sales order
    si_data = supabase.table("sale_invoices").select("*, customers(*), sales_orders(*)").eq("id", sale_invoice_id).execute()
    if not si_data.data:
        return JSONResponse(content={"error": "Sale invoice not found"}, status_code=404)
    
    # Get items for this sale invoice
    items_data = supabase.table("sale_invoice_items").select("*, products(*)").eq("invoice_id", sale_invoice_id).execute()
    
    # Transform sale invoice
    sale_invoice = to_camel_case_sale_invoice(si_data.data[0])
    sale_invoice["items"] = [to_camel_case_sale_invoice_item(item) for item in items_data.data]
    
    return JSONResponse(content=sale_invoice)

@app.get("/sale-invoices/{sale_invoice_id}/items")
def get_sale_invoice_items(sale_invoice_id: str, payload=Depends(require_permission("sale_invoices_view"))):
    # Get items for this sale invoice
    data = supabase.table("sale_invoice_items").select("*, products(*)").eq("invoice_id", sale_invoice_id).execute()
    transformed_data = [to_camel_case_sale_invoice_item(item) for item in data.data]
    return JSONResponse(content=transformed_data)

@app.post("/sale-invoices")
def create_sale_invoice(sale_invoice: dict = Body(...), payload=Depends(require_permission("sale_invoices_create"))):
    try:
        # Check if this is a direct sale invoice (not linked to existing sales order)
        is_direct = sale_invoice.get("isDirect", False)
        sales_order_id = sale_invoice.get("salesOrderId")
        
        # Get customer information for credit validation and payment method defaults
        customer_id = sale_invoice.get("customerId")
        if not customer_id:
            raise HTTPException(status_code=400, detail="Customer ID is required")
        
        # Get customer details including type and credit limit
        customer_data = supabase.table("customers").select("customer_type, credit_limit").eq("id", customer_id).execute()
        if not customer_data.data:
            raise HTTPException(status_code=400, detail="Customer not found")
        
        customer = customer_data.data[0]
        customer_type = customer.get("customer_type", "retail")
        credit_limit = customer.get("credit_limit", 0)
        
        # Set default payment method for wholesale customers
        payment_method = sale_invoice.get("paymentMethod")
        if not payment_method and customer_type in ["wholesale", "distributor"]:
            payment_method = "credit"
            sale_invoice["paymentMethod"] = "credit"
        
        # Validate credit limit for wholesale customers
        if customer_type in ["wholesale", "distributor"] and payment_method == "credit":
            # Call the credit validation function
            credit_check_result = supabase.rpc("check_customer_credit_limit", {
                "p_customer_id": customer_id,
                "p_invoice_amount": sale_invoice.get("totalAmount", 0)
            }).execute()
            
            # The function returns True if credit is sufficient, False otherwise
            if not credit_check_result.data:
                raise HTTPException(
                    status_code=400, 
                    detail="Insufficient credit limit: Credit limit exceeded"
                )
        
        # If it's a direct sale invoice, create a sales order first
        if is_direct and not sales_order_id:
            # Create sales order data from sale invoice data
            sales_order_data = {
                "order_number": f"SO-{sale_invoice['invoiceNumber']}",  # Generate order number from invoice number
                "customer_po_number": sale_invoice.get("customerPoNumber"),
                "customer_id": sale_invoice["customerId"],
                "billing_address": sale_invoice.get("billingAddress"),
                "shipping_address": sale_invoice.get("shippingAddress"),
                "order_date": sale_invoice["invoiceDate"],  # Use invoice date as order date
                "due_date": sale_invoice.get("dueDate"),
                "status": "approved",  # Set status to approved since it's being invoiced
                "subtotal": float(sale_invoice["subtotal"]),
                "tax_amount": float(sale_invoice["taxAmount"]),
                "discount_amount": float(sale_invoice["discountAmount"]),
                "total_amount": float(sale_invoice["totalAmount"]),
                "rounding_adjustment": float(sale_invoice.get("roundingAdjustment", 0)),
                "notes": f"Auto-generated from direct sale invoice {sale_invoice['invoiceNumber']}",
                "created_by": payload["sub"]
            }
            
            # Create the sales order
            so_data = supabase.table("sales_orders").insert(sales_order_data).execute()
            created_sales_order = so_data.data[0] if so_data.data else None
            
            if not created_sales_order:
                raise HTTPException(status_code=500, detail="Failed to create auto-generated sales order")
            
            # Set the sales order ID for the sale invoice
            sales_order_id = created_sales_order["id"]
            
            # Create sales order items from sale invoice items
            items = sale_invoice.get("items", [])
            if items and len(items) > 0:
                so_items_data = []
                for item in items:
                    so_item_data = {
                        "sales_order_id": created_sales_order["id"],
                        "product_id": item["productId"] if item["productId"] else None,
                        "product_name": item["productName"],
                        "sku_code": item["skuCode"],
                        "hsn_code": item["hsnCode"],
                        "quantity": int(float(item["quantity"])),
                        "unit_price": float(item["unitPrice"]),
                        "discount": float(item["discount"]),
                        "tax": float(item["tax"]),
                        "sale_tax_type": item.get("saleTaxType", "exclusive"),
                        "unit_abbreviation": item.get("unitAbbreviation", ""),
                        "created_by": payload["sub"]
                    }
                    
                    # Validate required UUID fields for items
                    if not so_item_data["product_id"]:
                        raise HTTPException(status_code=400, detail="Product ID is required for all items")
                    
                    if not so_item_data["created_by"]:
                        raise HTTPException(status_code=400, detail="Created by user ID is required")
                    
                    so_items_data.append(so_item_data)
                
                # Insert all sales order items
                if so_items_data:
                    supabase.table("sales_order_items").insert(so_items_data).execute()
        
        # Map camelCase to snake_case for sale invoice
        sale_invoice_data = {
            "invoice_number": sale_invoice["invoiceNumber"],
            "customer_po_number": sale_invoice.get("customerPoNumber"),
            "sales_order_id": sales_order_id,
            "customer_id": sale_invoice["customerId"] if sale_invoice["customerId"] else None,
            "billing_address": sale_invoice.get("billingAddress"),
            "shipping_address": sale_invoice.get("shippingAddress"),
            "invoice_date": sale_invoice["invoiceDate"],
            "due_date": sale_invoice.get("dueDate"),
            "status": sale_invoice["status"],
            "payment_method": payment_method,  # Add payment method
            "subtotal": float(sale_invoice["subtotal"]),
            "tax_amount": float(sale_invoice["taxAmount"]),
            "discount_amount": float(sale_invoice["discountAmount"]),
            "total_amount": float(sale_invoice["totalAmount"]),
            "rounding_adjustment": float(sale_invoice.get("roundingAdjustment", 0)),
            "gst_type": sale_invoice.get("gstType", "IGST"),
            "cgst_amount": float(sale_invoice.get("cgstAmount", 0)),
            "sgst_amount": float(sale_invoice.get("sgstAmount", 0)),
            "igst_amount": float(sale_invoice.get("igstAmount", 0)),
            "is_direct": is_direct,  # Set is_direct flag
            "notes": sale_invoice.get("notes"),
            "created_by": payload["sub"] if payload["sub"] else None,
            # Initialize amount_paid and amount_due for proper payment tracking
            "amount_paid": 0,
            "amount_due": float(sale_invoice["totalAmount"]),
        }
        
        # Validate required UUID fields
        if not sale_invoice_data["customer_id"]:
            raise HTTPException(status_code=400, detail="Customer ID is required")
        
        if not sale_invoice_data["created_by"]:
            raise HTTPException(status_code=400, detail="Created by user ID is required")
        
        # Validate payment method is required
        if not sale_invoice_data["payment_method"]:
            raise HTTPException(status_code=400, detail="Payment method is required")
        
        # Create the sale invoice
        data = supabase.table("sale_invoices").insert(sale_invoice_data).execute()
        created_sale_invoice = data.data[0] if data.data else None
        
        if not created_sale_invoice:
            raise HTTPException(status_code=500, detail="Failed to create sale invoice")
        
        # Insert items if they exist
        items = sale_invoice.get("items", [])
        if items and len(items) > 0:
            # Validate serial numbers BEFORE creating items_data
            for item in items:
                serials = item.get("serialNumbers") or []
                if serials and item.get("productId"):
                    try:
                        operation = "sell" if sale_invoice.get("status") == "sent" else "reserve"
                        validated_serials = _validate_serials_for_product(
                            item["productId"], 
                            serials, 
                            operation=operation
                        )
                        # Also validate that quantity matches serial count
                        if len(validated_serials) != item.get("quantity", 0):
                            raise HTTPException(
                                status_code=400, 
                                detail=f"Quantity ({item.get('quantity', 0)}) must match serial count ({len(validated_serials)}) for serialized product"
                            )
                    except Exception as e:
                        raise HTTPException(status_code=400, detail=f"Serial validation failed: {str(e)}")
            
            items_data = []
            for item in items:
                item_data = {
                    "invoice_id": created_sale_invoice["id"],
                    "product_id": item["productId"] if item["productId"] else None,
                    "product_name": item["productName"],
                    "sku_code": item["skuCode"],
                    "hsn_code": item["hsnCode"],
                    "quantity": int(float(item["quantity"])),
                    "unit_price": float(item["unitPrice"]),
                    "discount": float(item["discount"]),
                    "tax": float(item["tax"]),
                    "sale_tax_type": item.get("saleTaxType", "exclusive"),
                    "unit_abbreviation": item.get("unitAbbreviation", ""),
                    "created_by": payload["sub"] if payload["sub"] else None
                }
                
                # Validate required UUID fields for items
                if not item_data["product_id"]:
                    raise HTTPException(status_code=400, detail="Product ID is required for all items")
                
                if not item_data["created_by"]:
                    raise HTTPException(status_code=400, detail="Created by user ID is required")
                
                items_data.append(item_data)
            
            # Insert all items
            if items_data:
                result = supabase.table("sale_invoice_items").insert(items_data).execute()
                # Reserve serials on draft, or mark sold on sent (finalized)
                if result and result.data:
                    finalize_now = (created_sale_invoice.get("status") == "sent")
                    for idx, inserted in enumerate(result.data):
                        try:
                            raw_item = items[idx]
                            serials = raw_item.get("serialNumbers") or []
                            if serials and raw_item.get("productId"):
                                _reserve_or_sell_serials_for_invoice_item(raw_item["productId"], serials, inserted["id"], finalize=finalize_now, created_by=payload["sub"])
                        except Exception as _:
                            pass
        
        # Update linked sales order status if invoice is created with "sent" status
        if created_sale_invoice["status"] == "sent" and created_sale_invoice["sales_order_id"]:
            supabase.table("sales_orders").update({"status": "sent"}).eq("id", created_sale_invoice["sales_order_id"]).execute()
        
        return JSONResponse(content=created_sale_invoice)
    except Exception as e:
        print(f"CREATE SALE INVOICE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sale-invoices/overdue")
def get_overdue_invoices(payload=Depends(require_permission("sale_invoices_view"))):
    """Get all overdue sale invoices."""
    today = date.today().isoformat()
    data = supabase.table("sale_invoices").select("*").lt("due_date", today).in_("status", ["sent", "partial"]).execute()
    return JSONResponse(content=data.data)

@app.put("/sale-invoices/{sale_invoice_id}")
def update_sale_invoice(sale_invoice_id: str, sale_invoice: dict = Body(...), payload=Depends(require_permission("sale_invoices_edit"))):
    # Get current sale invoice status for validation
    current_invoice_data = supabase.table("sale_invoices").select("status").eq("id", sale_invoice_id).execute()
    if not current_invoice_data.data:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    current_status = current_invoice_data.data[0]["status"]
    
    # Validate status transition
    validate_sale_invoice_status_transition(current_status, operation="edit")
    
    # Map camelCase to snake_case
    sale_invoice_data = {
        "invoice_number": sale_invoice["invoiceNumber"],
        "customer_po_number": sale_invoice.get("customerPoNumber"),
        "sales_order_id": sale_invoice.get("salesOrderId") if sale_invoice.get("salesOrderId") else None,
        "customer_id": sale_invoice["customerId"] if sale_invoice["customerId"] else None,
        "billing_address": sale_invoice.get("billingAddress"),
        "shipping_address": sale_invoice.get("shippingAddress"),
        "invoice_date": sale_invoice["invoiceDate"],
        "due_date": sale_invoice.get("dueDate"),
        "status": sale_invoice["status"],
        "subtotal": sale_invoice["subtotal"],
        "tax_amount": sale_invoice["taxAmount"],
        "discount_amount": sale_invoice["discountAmount"],
        "total_amount": sale_invoice["totalAmount"],
        "rounding_adjustment": sale_invoice.get("roundingAdjustment", 0), # Added
        "gst_type": sale_invoice.get("gstType", "IGST"),
        "cgst_amount": sale_invoice.get("cgstAmount", 0),
        "sgst_amount": sale_invoice.get("sgstAmount", 0),
        "igst_amount": sale_invoice.get("igstAmount", 0),
        "is_direct": sale_invoice.get("isDirect", False), # Added
        "notes": sale_invoice.get("notes")
    }
    
    # Validate required UUID fields
    if not sale_invoice_data["customer_id"]:
        raise HTTPException(status_code=400, detail="Customer ID is required")
    
    # Update the sale invoice
    data = supabase.table("sale_invoices").update(sale_invoice_data).eq("id", sale_invoice_id).execute()
    updated_sale_invoice = data.data[0] if data.data else None
    
    if not updated_sale_invoice:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    # Handle items update
    items = sale_invoice.get("items", [])
    if items:
        # Delete existing items
        supabase.table("sale_invoice_items").delete().eq("invoice_id", sale_invoice_id).execute()
        
        # Validate serial numbers BEFORE creating items_data
        for item in items:
            serials = item.get("serialNumbers") or []
            if serials and item.get("productId"):
                try:
                    operation = "sell" if sale_invoice_data.get("status") == "sent" else "reserve"
                    validated_serials = _validate_serials_for_product(
                        item["productId"], 
                        serials, 
                        operation=operation
                    )
                    # Also validate that quantity matches serial count
                    if len(validated_serials) != item.get("quantity", 0):
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Quantity ({item.get('quantity', 0)}) must match serial count ({len(validated_serials)}) for serialized product"
                        )
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Serial validation failed: {str(e)}")
        
        # Insert new items
        items_data = []
        for item in items:
            item_data = {
                "invoice_id": sale_invoice_id,
                "product_id": item["productId"] if item["productId"] else None,
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "quantity": item["quantity"],
                "unit_price": item["unitPrice"],
                "discount": item["discount"],
                "tax": item["tax"],
                "sale_tax_type": item.get("saleTaxType", "exclusive"), # Added
                "unit_abbreviation": item.get("unitAbbreviation", ""), # Added
                "created_by": payload["sub"]
            }
            
            # Validate required UUID fields for items
            if not item_data["product_id"]:
                raise HTTPException(status_code=400, detail="Product ID is required for all items")
            
            if not item_data["created_by"]:
                raise HTTPException(status_code=400, detail="Created by user ID is required")
            
            items_data.append(item_data)
        
        if items_data:
            result = supabase.table("sale_invoice_items").insert(items_data).execute()
            # If invoice is sent now, mark serials sold; otherwise reserve
            if result and result.data:
                finalize_now = (sale_invoice_data.get("status") == "sent")
                for idx, inserted in enumerate(result.data):
                    try:
                        raw_item = items[idx]
                        serials = raw_item.get("serialNumbers") or []
                        if serials and raw_item.get("productId"):
                            _reserve_or_sell_serials_for_invoice_item(raw_item["productId"], serials, inserted["id"], finalize=finalize_now, created_by=payload["sub"])
                    except Exception as e:
                        # If serial handling fails, the entire update should fail
                        raise HTTPException(status_code=400, detail=f"Serial handling failed: {str(e)}")
    
    # Update linked sales order status based on invoice status changes
    new_status = sale_invoice["status"]
    if sale_invoice_data["sales_order_id"]:
        # Get current sales order status
        so_data = supabase.table("sales_orders").select("status").eq("id", sale_invoice_data["sales_order_id"]).execute()
        if so_data.data:
            current_so_status = so_data.data[0]["status"]
            
            # If invoice is being set to "sent", update sales order to "sent"
            if new_status == "sent" and current_so_status != "sent":
                supabase.table("sales_orders").update({"status": "sent"}).eq("id", sale_invoice_data["sales_order_id"]).execute()
            
            # If invoice is being set to "partial", update sales order to "partial"
            elif new_status == "partial" and current_so_status != "partial":
                supabase.table("sales_orders").update({"status": "partial"}).eq("id", sale_invoice_data["sales_order_id"]).execute()
            
            # If invoice is being set to "paid", update sales order to "fulfilled"
            elif new_status == "paid" and current_so_status != "fulfilled":
                supabase.table("sales_orders").update({"status": "fulfilled"}).eq("id", sale_invoice_data["sales_order_id"]).execute()
            
            # If invoice is being set to "cancelled", update sales order to "cancelled"
            elif new_status == "cancelled" and current_so_status != "cancelled":
                supabase.table("sales_orders").update({"status": "cancelled"}).eq("id", sale_invoice_data["sales_order_id"]).execute()
            
            # If invoice is being changed from "sent" to something else, revert sales order to "approved"
            elif current_status == "sent" and new_status not in ["sent", "paid", "cancelled"] and current_so_status == "sent":
                supabase.table("sales_orders").update({"status": "approved"}).eq("id", sale_invoice_data["sales_order_id"]).execute()
    
    return JSONResponse(content=updated_sale_invoice)

@app.delete("/sale-invoices/{sale_invoice_id}")
def delete_sale_invoice(sale_invoice_id: str, payload=Depends(require_permission("sale_invoices_delete"))):
    # Get current sale invoice status for validation
    current_invoice_data = supabase.table("sale_invoices").select("status, sales_order_id").eq("id", sale_invoice_id).execute()
    if not current_invoice_data.data:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    
    current_status = current_invoice_data.data[0]["status"]
    sales_order_id = current_invoice_data.data[0]["sales_order_id"]
    
    # Validate status transition
    validate_sale_invoice_status_transition(current_status, operation="delete")
    
    # If this invoice was linked to a sales order and was in "sent" status, revert sales order to "approved"
    if sales_order_id and current_status == "sent":
        # Get current sales order status
        so_data = supabase.table("sales_orders").select("status").eq("id", sales_order_id).execute()
        if so_data.data and so_data.data[0]["status"] == "sent":
            supabase.table("sales_orders").update({"status": "approved"}).eq("id", sales_order_id).execute()
    
    data = supabase.table("sale_invoices").delete().eq("id", sale_invoice_id).execute()
    return JSONResponse(content=data.data)

def to_camel_case_good_receive_note(grn):
    """Convert good receive note data from snake_case to camelCase"""
    return {
        "id": grn.get("id"),
        "grnNumber": grn.get("grn_number"),
        "purchaseOrderId": grn.get("purchase_order_id"),
        "purchaseOrder": to_camel_case_purchase_order(grn.get("purchase_orders", {})) if grn.get("purchase_orders") else None,
        "supplierId": grn.get("supplier_id"),
        "supplier": grn.get("suppliers", {}),
        "receivedDate": grn.get("received_date"),
        "vendorInvoiceNumber": grn.get("vendor_invoice_number"),
        "receivedBy": grn.get("received_by"),
        "receivedByUser": to_camel_case_user(grn.get("profiles", {})) if grn.get("profiles") else None,
        "status": grn.get("status"),
        "totalReceivedItems": grn.get("total_received_items"),
        "notes": grn.get("notes"),
        "qualityCheckStatus": grn.get("quality_check_status"),
        "warehouseLocation": grn.get("warehouse_location"),
        "subtotal": grn.get("subtotal"),
        "taxAmount": grn.get("tax_amount"),
        "discountAmount": grn.get("discount_amount"),
        "totalAmount": grn.get("total_amount"),
        "roundingAdjustment": grn.get("rounding_adjustment"),
        "isDirect": grn.get("is_direct", False),
        "items": [to_camel_case_good_receive_note_item(item) for item in grn.get("items", [])],
        "createdAt": grn.get("created_at"),
        "updatedAt": grn.get("updated_at")
    }

def to_camel_case_good_receive_note_item(item):
    """Convert good receive note item data from snake_case to camelCase"""
    return {
        "id": item.get("id"),
        "grnId": item.get("grn_id"),
        "purchaseOrderItemId": item.get("purchase_order_item_id"),
        "productId": item.get("product_id"),
        "productName": item.get("products", {}).get("name") if item.get("products") else item.get("product_name"),
        "skuCode": item.get("products", {}).get("sku_code") if item.get("products") else item.get("sku_code"),
        "hsnCode": item.get("products", {}).get("hsn_code") if item.get("products") else item.get("hsn_code"),
        "orderedQuantity": item.get("ordered_quantity"),
        "receivedQuantity": item.get("received_quantity"),
        "rejectedQuantity": item.get("rejected_quantity"),
        "acceptedQuantity": item.get("accepted_quantity"),
        "unitCost": item.get("unit_cost"),
        "discount": item.get("discount", 0), # Added
        "tax": item.get("tax", 0), # Added
        "total": item.get("total", 0), # Added
        "batchNumber": item.get("batch_number"),
        "expiryDate": item.get("expiry_date"),
        "manufacturingDate": item.get("manufacturing_date"),
        "qualityNotes": item.get("quality_notes"),
        "storageLocation": item.get("storage_location"),
        "eanCode": item.get("ean_code"),
        "purchaseTaxType": item.get("purchase_tax_type", "exclusive"), # Added
        "unitAbbreviation": item.get("unit_abbreviation", ""), # Added
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
    }

# Good Receive Notes API endpoints
@app.get("/good-receive-notes")
def get_good_receive_notes(payload=Depends(require_permission("grn_view"))):
    # Join with purchase orders and profiles to get order numbers and user names
    try:
        # Use a fresh Supabase client to avoid connection issues
        fresh_supabase = get_supabase_client()
        
        # First get all GRNs
        grn_data = fresh_supabase.table("good_receive_notes").select("*").execute()
        
        # Then get all profiles for the received_by IDs
        received_by_ids = list(set([grn["received_by"] for grn in grn_data.data if grn.get("received_by")]))
        profiles_data = {}
        if received_by_ids:
            profiles_result = fresh_supabase.table("profiles").select("*").in_("id", received_by_ids).execute()
            profiles_data = {profile["id"]: profile for profile in profiles_result.data}
        
        # Get purchase orders
        purchase_order_ids = list(set([grn["purchase_order_id"] for grn in grn_data.data if grn.get("purchase_order_id")]))
        purchase_orders_data = {}
        if purchase_order_ids:
            po_result = fresh_supabase.table("purchase_orders").select("*").in_("id", purchase_order_ids).execute()
            purchase_orders_data = {po["id"]: po for po in po_result.data}
        
        # Get items for all GRNs
        grn_ids = [grn["id"] for grn in grn_data.data]
        items_data = {}
        if grn_ids:
            items_result = fresh_supabase.table("good_receive_note_items").select("*, products(*)").in_("grn_id", grn_ids).execute()
            for item in items_result.data:
                grn_id = item["grn_id"]
                if grn_id not in items_data:
                    items_data[grn_id] = []
                items_data[grn_id].append(item)
        
        # Combine the data
        for grn in grn_data.data:
            grn["profiles"] = profiles_data.get(grn.get("received_by"))
            grn["purchase_orders"] = purchase_orders_data.get(grn.get("purchase_order_id"))
            grn["items"] = items_data.get(grn["id"], [])
        
        # Transform to camelCase
        transformed_data = [to_camel_case_good_receive_note(grn) for grn in grn_data.data]
        return JSONResponse(content=transformed_data)
    except Exception as e:
        print(f"ERROR fetching GRNs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching GRNs: {str(e)}")

@app.get("/good-receive-notes/{grn_id}")
def get_good_receive_note(grn_id: str, payload=Depends(require_permission("grn_view"))):
    try:
        # Use a fresh Supabase client to avoid connection issues
        fresh_supabase = get_supabase_client()
        
        # Get GRN with purchase order and profiles
        grn_data = fresh_supabase.table("good_receive_notes").select("*, purchase_orders(*), profiles!good_receive_notes_received_by_fkey(*)").eq("id", grn_id).execute()
        if not grn_data.data:
            return JSONResponse(content={"error": "GRN not found"}, status_code=404)
        
        # Get items for this GRN
        items_data = fresh_supabase.table("good_receive_note_items").select("*, products(*)").eq("grn_id", grn_id).execute()
        
        # Transform GRN
        grn = to_camel_case_good_receive_note(grn_data.data[0])
        grn["items"] = [to_camel_case_good_receive_note_item(item) for item in items_data.data]
        
        return JSONResponse(content=grn)
    except Exception as e:
        print(f"ERROR fetching GRN {grn_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching GRN: {str(e)}")

@app.get("/good-receive-notes/{grn_id}/items")
def get_good_receive_note_items(grn_id: str, payload=Depends(require_permission("grn_view"))):
    # Get items for this GRN
    data = supabase.table("good_receive_note_items").select("*, products(*)").eq("grn_id", grn_id).execute()
    transformed_data = [to_camel_case_good_receive_note_item(item) for item in data.data]
    return JSONResponse(content=transformed_data)

@app.post("/good-receive-notes")
def create_good_receive_note(good_receive_note: dict = Body(...), payload=Depends(require_permission("grn_create"))):
    try:
        # Validate required fields based on creation mode
        is_direct = good_receive_note.get("isDirect", False)
        
        if not is_direct:  # linked mode
            if not good_receive_note.get("purchaseOrderId"):
                raise HTTPException(status_code=400, detail="Purchase Order ID is required for linked GRN")
            # For linked mode, we need to get supplier_id from the purchase order
            try:
                po_data = supabase.table("purchase_orders").select("supplier_id").eq("id", good_receive_note["purchaseOrderId"]).execute()
                if not po_data.data:
                    raise HTTPException(status_code=400, detail="Purchase Order not found")
                supplier_id = po_data.data[0]["supplier_id"]
                purchase_order_id = good_receive_note["purchaseOrderId"]
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error fetching purchase order: {str(e)}")
        else:  # direct mode
            if not good_receive_note.get("supplierId"):
                raise HTTPException(status_code=400, detail="Supplier ID is required for direct GRN")
            supplier_id = good_receive_note["supplierId"]
            
            # For direct mode, create a purchase order first
            try:
                # Generate a PO number
                today = datetime.now()
                po_number = f"PO-{today.strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
                # Calculate totals from GRN items (server-side tax computation)
                raw_items = good_receive_note.get("items", []) or []
                product_ids = [it.get("productId") for it in raw_items if it.get("productId")]
                products_map = {}
                if product_ids:
                    try:
                        if DEBUG_MODE:
                            print(f"DEBUG: Direct GRN - Looking up tax data for product IDs: {product_ids}")
                        prod_res = supabase.table("products").select("id, purchase_tax_type, purchase_tax_id, taxes!purchase_tax_id(rate)").in_("id", product_ids).execute()
                        if DEBUG_MODE:
                            print(f"DEBUG: Direct GRN - Product tax data query result: {prod_res.data}")
                        for prod in prod_res.data:
                            # Extract rate from the taxes join
                            rate = 0.0
                            if prod.get("taxes") and isinstance(prod.get("taxes"), dict):
                                rate = float(prod.get("taxes", {}).get("rate") or 0)
                            products_map[prod["id"]] = {
                                "type": prod.get("purchase_tax_type") or "exclusive",
                                "rate": rate,
                            }
                            if DEBUG_MODE:
                                print(f"DEBUG: Direct GRN - Product {prod['id']} tax data: type={prod.get('purchase_tax_type')}, rate={rate}, tax_id={prod.get('purchase_tax_id')}")
                        if DEBUG_MODE:
                            print(f"DEBUG: Direct GRN - Final products_map: {products_map}")
                    except Exception as e:
                        if DEBUG_MODE:
                            print(f"DEBUG: Direct GRN - Error fetching product tax data: {e}")
                        products_map = {}
                processed_items = []
                subtotal = 0.0
                tax_amount = 0.0
                discount_amount = 0.0
                for it in raw_items:
                    qty = float(it.get("receivedQuantity") or 0)
                    unit_cost = float(it.get("unitCost") or 0)
                    discount = float(it.get("discount") or 0)
                    prod = products_map.get(it.get("productId"), {"type": it.get("purchaseTaxType", "exclusive"), "rate": 0.0})
                    tax_type = it.get("purchaseTaxType") or prod.get("type") or "exclusive"
                    rate = float(prod.get("rate") or 0.0)
                    if DEBUG_MODE:
                        print(f"DEBUG: Direct GRN - Item {it.get('productId')} tax calculation: prod_data={prod}, tax_type={tax_type}, rate={rate}")
                    line_subtotal = qty * unit_cost
                    amount_after_discount = line_subtotal - discount
                    if tax_type == "inclusive":
                        line_tax = amount_after_discount - (amount_after_discount / (1 + rate)) if amount_after_discount > 0 and rate > 0 else 0.0
                        line_total = amount_after_discount
                    else:
                        line_tax = amount_after_discount * rate
                        line_total = amount_after_discount + line_tax
                    processed_item = {
                        **it,
                        "discount": discount,
                        "purchaseTaxType": tax_type,
                        "tax": round(line_tax, 2),
                        "total": round(line_total, 2),
                    }
                    if DEBUG_MODE:
                        print(f"DEBUG: Direct GRN processed item: {processed_item}")
                    processed_items.append(processed_item)
                    subtotal += line_subtotal
                    discount_amount += discount
                    tax_amount += 0.0 if tax_type == "inclusive" else line_tax
                total_amount = good_receive_note.get("totalAmount") or (subtotal - discount_amount + tax_amount)
                
                # Use delivery date from GRN if provided, otherwise default to received date + 7 days
                delivery_date = good_receive_note.get("deliveryDate")
                if delivery_date:
                    expected_delivery = delivery_date
                else:
                    # Default to 7 days from received date
                    received_date = datetime.fromisoformat(good_receive_note["receivedDate"].replace('Z', '+00:00')) if isinstance(good_receive_note["receivedDate"], str) else good_receive_note["receivedDate"]
                    expected_delivery = (received_date + timedelta(days=7)).isoformat()

                if DEBUG_MODE:
                    print(f"DEBUG: Auto-generated PO totals - subtotal: {subtotal}, tax_amount: {tax_amount}, discount_amount: {discount_amount}, total_amount: {total_amount}")
                po_data = {
                    "order_number": po_number,
                    "supplier_id": supplier_id,
                    "order_date": good_receive_note["receivedDate"],
                    "expected_delivery_date": expected_delivery,
                    "status": "approved",  # Auto-approve for direct GRN
                    "subtotal": subtotal,
                    "tax_amount": tax_amount,
                    "discount_amount": discount_amount,
                    "total_amount": total_amount,
                    "notes": f"Auto-generated PO for GRN {good_receive_note['grnNumber']}",
                    "created_by": payload["sub"]
                }
                
                po_result = supabase.table("purchase_orders").insert(po_data).execute()
                if not po_result.data:
                    raise HTTPException(status_code=500, detail="Failed to create purchase order for direct GRN")
                
                purchase_order_id = po_result.data[0]["id"]
                
                # Create purchase order items from GRN items
                if processed_items:
                    po_items_data = []
                    for item in processed_items:
                        po_item_data = {
                            "purchase_order_id": purchase_order_id,
                            "product_id": item["productId"],
                            "product_name": item["productName"],
                            "sku_code": item["skuCode"],
                            "hsn_code": item["hsnCode"],
                            "quantity": item["receivedQuantity"],  # Use receivedQuantity for direct GRN
                            "cost_price": item["unitCost"],
                            "discount": item.get("discount", 0),
                            "tax": item.get("tax", 0),
                            "purchase_tax_type": item.get("purchaseTaxType", "exclusive"),
                            "unit_abbreviation": item.get("unitAbbreviation", ""),
                            "created_by": payload["sub"]
                        }
                        po_items_data.append(po_item_data)
                    
                    if po_items_data:
                        po_items_result = supabase.table("purchase_order_items").insert(po_items_data).execute()
                        # Map the created PO item IDs back to the processed items for GRN
                        if po_items_result.data:
                            for i, po_item in enumerate(po_items_result.data):
                                if i < len(processed_items):
                                    processed_items[i]["purchaseOrderItemId"] = po_item["id"]
                        
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error creating purchase order: {str(e)}")
        
        if not good_receive_note.get("receivedDate"):
            raise HTTPException(status_code=400, detail="Received Date is required")
        
        if not good_receive_note.get("status"):
            raise HTTPException(status_code=400, detail="Status is required")
        
        if not payload.get("sub"):
            raise HTTPException(status_code=400, detail="User ID is required")
        
    # Map camelCase to snake_case
        # If not direct mode, still compute accurate totals from items provided
        _raw_items_for_grn = good_receive_note.get("items", []) or []
        _product_ids = [it.get("productId") for it in _raw_items_for_grn if it.get("productId")]
        _products_map = {}
        if _product_ids:
            try:
                _prod_res = supabase.table("products").select("id, purchase_tax_type, purchase_tax_id, taxes!purchase_tax_id(rate)").in_("id", _product_ids).execute()
                for prod in _prod_res.data:
                    rate = 0.0
                    if prod.get("taxes") and isinstance(prod.get("taxes"), dict):
                        rate = float(prod.get("taxes", {}).get("rate") or 0)
                    _products_map[prod["id"]] = {"type": prod.get("purchase_tax_type") or "exclusive", "rate": rate}
            except Exception:
                _products_map = {}
        _processed_items_for_grn = []
        _subtotal = 0.0
        _tax_amount = 0.0
        _discount_amount = 0.0
        
        # For Direct GRNs, use the already processed items (which have purchaseOrderItemId set)
        if good_receive_note.get("isDirect") and 'processed_items' in locals():
            _processed_items_for_grn = processed_items
            # Calculate totals from processed items
            for item in processed_items:
                _subtotal += float(item.get("receivedQuantity", 0)) * float(item.get("unitCost", 0))
                _discount_amount += float(item.get("discount", 0))
                _tax_amount += float(item.get("tax", 0))
        else:
            # For Linked GRNs or when processed_items not available, process from raw items
            for it in _raw_items_for_grn:
                qty = float(it.get("receivedQuantity") or 0)
                unit_cost = float(it.get("unitCost") or 0)
                discount = float(it.get("discount") or 0)
                prod = _products_map.get(it.get("productId"), {"type": it.get("purchaseTaxType", "exclusive"), "rate": 0.0})
                tax_type = it.get("purchaseTaxType") or prod.get("type") or "exclusive"
                rate = float(prod.get("rate") or 0.0)
                line_subtotal = qty * unit_cost
                amount_after_discount = line_subtotal - discount
                if tax_type == "inclusive":
                    line_tax = amount_after_discount - (amount_after_discount / (1 + rate)) if amount_after_discount > 0 and rate > 0 else 0.0
                    line_total = amount_after_discount
                else:
                    line_tax = amount_after_discount * rate
                    line_total = amount_after_discount + line_tax
                processed_item = {**it, "purchaseTaxType": tax_type, "discount": discount, "tax": round(line_tax, 2), "total": round(line_total, 2)}
                _processed_items_for_grn.append(processed_item)
                _subtotal += line_subtotal
                _discount_amount += discount
                _tax_amount += 0.0 if tax_type == "inclusive" else line_tax

        # Calculate total received items from the actual items
        _total_received_items = sum(int(item.get("receivedQuantity", 0)) for item in _processed_items_for_grn)
        
        if DEBUG_MODE:
            print(f"DEBUG: GRN totals - _subtotal: {_subtotal}, _tax_amount: {_tax_amount}, _discount_amount: {_discount_amount}, _total_received_items: {_total_received_items}")
        grn_data = {
        "grn_number": good_receive_note["grnNumber"],
            "purchase_order_id": purchase_order_id,
            "supplier_id": supplier_id,
        "received_date": good_receive_note["receivedDate"],
            "received_by": payload["sub"],
        "status": good_receive_note["status"],
            "total_received_items": _total_received_items,
            "notes": good_receive_note.get("notes", ""),
            "quality_check_status": (good_receive_note.get("qualityCheckStatus") or "pending"),
            "warehouse_location": good_receive_note.get("warehouseLocation", ""),
            "subtotal": round(_subtotal, 2),
            "tax_amount": round(_tax_amount, 2),
            "discount_amount": round(_discount_amount, 2),
            "total_amount": round((_subtotal - _discount_amount + _tax_amount), 2),
            "rounding_adjustment": good_receive_note.get("roundingAdjustment", 0),
            "gst_type": good_receive_note.get("gstType", "IGST"),
            "cgst_amount": good_receive_note.get("cgstAmount", 0),
            "sgst_amount": good_receive_note.get("sgstAmount", 0),
            "igst_amount": good_receive_note.get("igstAmount", 0),
            "is_direct": is_direct,
            "vendor_invoice_number": good_receive_note.get("vendorInvoiceNumber")
        }
        
        # Create the GRN
        data = supabase.table("good_receive_notes").insert(grn_data).execute()
        created_grn = data.data[0] if data.data else None
        
        if not created_grn:
            raise HTTPException(status_code=500, detail="Failed to create good receive note")
    except Exception as e:
        print(f"Error creating GRN: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create good receive note: {str(e)}")
    
    # Insert items if they exist (use processed values with computed tax/total)
    items = _processed_items_for_grn
    if DEBUG_MODE:
        print(f"DEBUG: Processed items for GRN creation: {items}")
    if items and len(items) > 0:
        items_data = []
        for item in items:
            item_data = {
                "grn_id": created_grn["id"],
                "purchase_order_item_id": item.get("purchaseOrderItemId"),
                "product_id": item["productId"],
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "ordered_quantity": item["orderedQuantity"],
                "received_quantity": item["receivedQuantity"],
                "rejected_quantity": item.get("rejectedQuantity", 0),
                "unit_cost": item["unitCost"],
                "discount": item.get("discount", 0), # Added
                "tax": item.get("tax", 0), # Added
                "batch_number": item.get("batchNumber"),
                "ean_code": item.get("eanCode"),
                "expiry_date": item.get("expiryDate"),
                "manufacturing_date": item.get("manufacturingDate"),
                "quality_notes": item.get("qualityNotes"),
                "storage_location": item.get("storageLocation"),
                "purchase_tax_type": item.get("purchaseTaxType", "exclusive"), # Added
                "unit_abbreviation": item.get("unitAbbreviation", ""), # Added
                "created_by": payload["sub"]
    }
            items_data.append(item_data)
        
        # Insert all items
        if items_data:
            try:
                result = supabase.table("good_receive_note_items").insert(items_data).execute()
                # If serial numbers provided for any item, persist them to product_serials
                if result and result.data:
                    # Map back by position
                    for idx, inserted in enumerate(result.data):
                        try:
                            raw_item = items[idx]
                            serials = raw_item.get("serialNumbers") or []
                            print(f"DEBUG: Processing GRN item {idx}, raw serials: {serials}")
                            # Accept string input: comma/newline separated
                            if isinstance(serials, str):
                                serials = [s.strip() for s in serials.replace('\r', '\n').replace(',', '\n').split('\n') if s.strip()]
                                print(f"DEBUG: Parsed string serials: {serials}")
                            if serials and raw_item.get("productId"):
                                print(f"DEBUG: Creating serials for product {raw_item['productId']}: {serials}")
                                _create_serials_for_grn_item(raw_item["productId"], serials, inserted["id"])
                            else:
                                print(f"DEBUG: No serials to create for item {idx}. Serials: {serials}, ProductId: {raw_item.get('productId')}")
                        except Exception as e:
                            # Do not fail entire GRN if serial insert fails; surface later via validation if needed
                            print(f"DEBUG: Error creating serials for item {idx}: {str(e)}")
                            pass
            except Exception as e:
                print(f"Error inserting GRN items: {str(e)}")
                # If items fail to insert, we should still return the created GRN
                # but log the error for debugging
    
    # Recompute purchase order status based on all GRNs for this PO
    if created_grn.get("purchase_order_id"):
        try:
            update_purchase_order_status_from_grns(created_grn["purchase_order_id"]) 
        except Exception as _:
            pass
    
    return JSONResponse(content=created_grn)

@app.put("/good-receive-notes/{good_receive_note_id}")
def update_good_receive_note(good_receive_note_id: str, good_receive_note: dict = Body(...), payload=Depends(require_permission("grn_edit"))):
    # Get current GRN status for validation
    current_grn_data = supabase.table("good_receive_notes").select("status").eq("id", good_receive_note_id).execute()
    if not current_grn_data.data:
        raise HTTPException(status_code=404, detail="Good receive note not found")
    
    current_status = current_grn_data.data[0]["status"]
    
    # Validate status transition
    validate_grn_status_transition(current_status, operation="edit")
    
    # Calculate total received items from the items
    items = good_receive_note.get("items", [])
    total_received_items = sum(int(item.get("receivedQuantity", 0)) for item in items)
    
    # Map camelCase to snake_case
    grn_data = {
        "grn_number": good_receive_note["grnNumber"],
        "purchase_order_id": good_receive_note["purchaseOrderId"],
        "supplier_id": good_receive_note["supplierId"],
        "received_date": good_receive_note["receivedDate"],
        "status": good_receive_note["status"],
        "total_received_items": total_received_items,
        "notes": good_receive_note.get("notes"),
        "quality_check_status": (good_receive_note.get("qualityCheckStatus") or "pending"),
        "warehouse_location": good_receive_note.get("warehouseLocation"),
        "subtotal": good_receive_note.get("subtotal", 0),
        "tax_amount": good_receive_note.get("taxAmount", 0),
        "discount_amount": good_receive_note.get("discountAmount", 0),
        "total_amount": good_receive_note.get("totalAmount", 0),
        "rounding_adjustment": good_receive_note.get("roundingAdjustment", 0), # Added
        "vendor_invoice_number": good_receive_note.get("vendorInvoiceNumber")
    }
    
    # Update the GRN
    data = supabase.table("good_receive_notes").update(grn_data).eq("id", good_receive_note_id).execute()
    updated_grn = data.data[0] if data.data else None
    
    if not updated_grn:
        raise HTTPException(status_code=404, detail="Good receive note not found")
    
    # Recompute linked purchase order status based on all GRNs for this PO
    if grn_data.get("purchase_order_id"):
        try:
            update_purchase_order_status_from_grns(grn_data["purchase_order_id"]) 
        except Exception as _:
            pass
    
    # Handle items update
    items = good_receive_note.get("items", [])
    if items:
        # Delete existing items
        supabase.table("good_receive_note_items").delete().eq("grn_id", good_receive_note_id).execute()
        
        # Insert new items
        items_data = []
        for item in items:
            item_data = {
                "grn_id": good_receive_note_id,
                "purchase_order_item_id": item.get("purchaseOrderItemId"),
                "product_id": item["productId"],
                "product_name": item["productName"],
                "sku_code": item["skuCode"],
                "hsn_code": item["hsnCode"],
                "ordered_quantity": item["orderedQuantity"],
                "received_quantity": item["receivedQuantity"],
                "rejected_quantity": item.get("rejectedQuantity", 0),
                "unit_cost": item["unitCost"],
                "discount": item.get("discount", 0), # Added
                "tax": item.get("tax", 0), # Added
                "batch_number": item.get("batchNumber"),
                "ean_code": item.get("eanCode"),
                "expiry_date": item.get("expiryDate"),
                "manufacturing_date": item.get("manufacturingDate"),
                "quality_notes": item.get("qualityNotes"),
                "storage_location": item.get("storageLocation"),
                "purchase_tax_type": item.get("purchaseTaxType", "exclusive"), # Added
                "unit_abbreviation": item.get("unitAbbreviation", ""), # Added
                "created_by": payload["sub"]
            }
            items_data.append(item_data)
        
        if items_data:
            supabase.table("good_receive_note_items").insert(items_data).execute()
    
    return JSONResponse(content=updated_grn)

@app.delete("/good-receive-notes/{good_receive_note_id}")
def delete_good_receive_note(good_receive_note_id: str, payload=Depends(require_permission("grn_delete"))):
    # Get current GRN status for validation
    current_grn_data = supabase.table("good_receive_notes").select("status, purchase_order_id").eq("id", good_receive_note_id).execute()
    if not current_grn_data.data:
        raise HTTPException(status_code=404, detail="Good receive note not found")
    
    current_status = current_grn_data.data[0]["status"]
    purchase_order_id = current_grn_data.data[0]["purchase_order_id"]
    
    # Validate status transition
    validate_grn_status_transition(current_status, operation="delete")
    
    # Recompute PO status after deletion
    if purchase_order_id:
        try:
            update_purchase_order_status_from_grns(purchase_order_id)
        except Exception as _:
            pass
    
    data = supabase.table("good_receive_notes").delete().eq("id", good_receive_note_id).execute()
    return JSONResponse(content=data.data)

# ==================== Quality Checks (QC) API ====================

def to_camel_case_quality_check(qc):
    """Convert quality check data from snake_case to camelCase"""
    return {
        "id": qc.get("id"),
        "qcNumber": qc.get("qc_number"),
        "grnId": qc.get("grn_id"),
        "grn": to_camel_case_good_receive_note(qc.get("good_receive_notes", {})) if qc.get("good_receive_notes") else None,
        "inspectorId": qc.get("inspector_id"),
        "inspectorName": qc.get("inspector", {}).get("full_name") if qc.get("inspector") else None,
        "qcDate": qc.get("qc_date"),
        "status": qc.get("status"),
        "notes": qc.get("notes"),
        "createdBy": qc.get("created_by"),
        "items": [to_camel_case_quality_check_item(item) for item in qc.get("items", [])],
        "createdAt": qc.get("created_at"),
        "updatedAt": qc.get("updated_at")
    }

def to_camel_case_quality_check_item(item):
    """Convert quality check item data from snake_case to camelCase"""
    if not item:
        return {}
    return {
        "id": item.get("id"),
        "qcId": item.get("qc_id"),
        "grnItemId": item.get("grn_item_id"),
        "productId": item.get("product_id"),
        "productName": item.get("product_name") or (item.get("products", {}).get("name") if item.get("products") else None),
        "skuCode": item.get("sku_code") or (item.get("products", {}).get("sku_code") if item.get("products") else None),
        "receivedQuantity": float(item.get("received_quantity") or 0),
        "inspectedQuantity": float(item.get("inspected_quantity") or 0),
        "passedQuantity": float(item.get("passed_quantity") or 0),
        "failedQuantity": float(item.get("failed_quantity") or 0),
        "failureReason": item.get("failure_reason"),
        "notes": item.get("notes"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at")
    }

@app.get("/quality-checks")
def get_quality_checks(payload=Depends(require_permission("quality_checks_view"))):
    """Get all quality checks with related data."""
    try:
        fresh_supabase = get_supabase_client()
        
        # Get all QCs
        qc_data = fresh_supabase.table("quality_checks").select("*").execute()
        
        if not qc_data.data:
            return JSONResponse(content=[])
        
        # Get inspector profiles
        inspector_ids = list(set([qc["inspector_id"] for qc in qc_data.data if qc.get("inspector_id")]))
        inspectors = {}
        if inspector_ids:
            insp_result = fresh_supabase.table("profiles").select("id, full_name").in_("id", inspector_ids).execute()
            inspectors = {p["id"]: p for p in insp_result.data}
        
        # Get GRN data for display
        grn_ids = list(set([qc["grn_id"] for qc in qc_data.data if qc.get("grn_id")]))
        grns = {}
        if grn_ids:
            grn_result = fresh_supabase.table("good_receive_notes").select("id, grn_number, status, supplier_id, suppliers(name)").in_("id", grn_ids).execute()
            grns = {g["id"]: g for g in grn_result.data}
        
        # Get items for all QCs
        qc_ids = [qc["id"] for qc in qc_data.data]
        items_by_qc = {}
        if qc_ids:
            items_result = fresh_supabase.table("quality_check_items").select("*, products(name, sku_code)").in_("qc_id", qc_ids).execute()
            for item in items_result.data:
                qc_id = item["qc_id"]
                if qc_id not in items_by_qc:
                    items_by_qc[qc_id] = []
                items_by_qc[qc_id].append(item)
        
        # Assemble response
        result = []
        for qc in qc_data.data:
            qc["inspector"] = inspectors.get(qc.get("inspector_id"))
            qc["good_receive_notes"] = grns.get(qc.get("grn_id"))
            qc["items"] = items_by_qc.get(qc["id"], [])
            result.append(to_camel_case_quality_check(qc))
        
        return JSONResponse(content=result)
    except Exception as e:
        print(f"ERROR fetching quality checks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching quality checks: {str(e)}")

@app.get("/quality-checks/{qc_id}")
def get_quality_check(qc_id: str, payload=Depends(require_permission("grn_view"))):
    """Get a single quality check with items."""
    try:
        fresh_supabase = get_supabase_client()
        
        qc_data = fresh_supabase.table("quality_checks").select("*").eq("id", qc_id).execute()
        if not qc_data.data:
            raise HTTPException(status_code=404, detail="Quality check not found")
        
        qc = qc_data.data[0]
        
        # Get inspector
        if qc.get("inspector_id"):
            insp_result = fresh_supabase.table("profiles").select("id, full_name").eq("id", qc["inspector_id"]).execute()
            qc["inspector"] = insp_result.data[0] if insp_result.data else None
        
        # Get GRN
        if qc.get("grn_id"):
            grn_result = fresh_supabase.table("good_receive_notes").select("*, purchase_orders(*), profiles!good_receive_notes_received_by_fkey(*)").eq("id", qc["grn_id"]).execute()
            qc["good_receive_notes"] = grn_result.data[0] if grn_result.data else None
        
        # Get items
        items_result = fresh_supabase.table("quality_check_items").select("*, products(name, sku_code)").eq("qc_id", qc_id).execute()
        qc["items"] = items_result.data or []
        
        return JSONResponse(content=to_camel_case_quality_check(qc))
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR fetching quality check {qc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching quality check: {str(e)}")

@app.post("/quality-checks")
def create_quality_check(qc: dict = Body(...), payload=Depends(require_permission("quality_checks_create"))):
    """Create a quality check from a GRN."""
    try:
        grn_id = qc.get("grnId")
        if not grn_id:
            raise HTTPException(status_code=400, detail="GRN ID is required")
        
        # Verify GRN exists and is in received status
        fresh_supabase = get_supabase_client()
        grn_data = fresh_supabase.table("good_receive_notes").select("id, status").eq("id", grn_id).execute()
        if not grn_data.data:
            raise HTTPException(status_code=404, detail="GRN not found")
        
        grn_status = grn_data.data[0]["status"]
        if grn_status not in ["received", "draft", "partial", "completed"]:
            raise HTTPException(status_code=400, detail=f"Cannot create QC for GRN with status '{grn_status}'. GRN must be in received, draft, partial, or completed status.")
        
        # Check if QC already exists for this GRN
        existing_qc = fresh_supabase.table("quality_checks").select("id").eq("grn_id", grn_id).execute()
        if existing_qc.data:
            raise HTTPException(status_code=400, detail="A quality check already exists for this GRN")
        
        # Create QC record
        qc_data = {
            "qc_number": qc["qcNumber"],
            "grn_id": grn_id,
            "inspector_id": qc.get("inspectorId") or payload["sub"],
            "qc_date": qc.get("qcDate", date.today().isoformat()),
            "status": qc.get("status", "pending"),
            "notes": qc.get("notes", ""),
            "created_by": payload["sub"]
        }
        
        result = fresh_supabase.table("quality_checks").insert(qc_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create quality check")
        
        created_qc = result.data[0]
        
        # Get GRN items and create QC items from them
        grn_items = fresh_supabase.table("good_receive_note_items").select("*, products(name, sku_code)").eq("grn_id", grn_id).execute()
        
        items = qc.get("items", [])
        if items:
            # Use items from request
            items_data = []
            for item in items:
                item_data = {
                    "qc_id": created_qc["id"],
                    "grn_item_id": item["grnItemId"],
                    "product_id": item["productId"],
                    "product_name": item.get("productName", ""),
                    "sku_code": item.get("skuCode", ""),
                    "received_quantity": item.get("receivedQuantity", 0),
                    "inspected_quantity": item.get("inspectedQuantity", 0),
                    "passed_quantity": item.get("passedQuantity", 0),
                    "failed_quantity": item.get("failedQuantity", 0),
                    "failure_reason": item.get("failureReason"),
                    "notes": item.get("notes")
                }
                items_data.append(item_data)
            fresh_supabase.table("quality_check_items").insert(items_data).execute()
        elif grn_items.data:
            # Auto-create items from GRN items
            items_data = []
            for grn_item in grn_items.data:
                product = grn_item.get("products", {})
                received_qty = grn_item.get("received_quantity", 0) - grn_item.get("rejected_quantity", 0)
                item_data = {
                    "qc_id": created_qc["id"],
                    "grn_item_id": grn_item["id"],
                    "product_id": grn_item["product_id"],
                    "product_name": product.get("name") if product else grn_item.get("product_name"),
                    "sku_code": product.get("sku_code") if product else grn_item.get("sku_code"),
                    "received_quantity": received_qty,
                    "inspected_quantity": 0,
                    "passed_quantity": 0,
                    "failed_quantity": 0
                }
                items_data.append(item_data)
            if items_data:
                fresh_supabase.table("quality_check_items").insert(items_data).execute()
        
        # Update GRN status to received if it's draft/partial
        if grn_status in ["draft", "partial"]:
            fresh_supabase.table("good_receive_notes").update({"status": "received"}).eq("id", grn_id).execute()
        
        # Update GRN quality_check_status
        fresh_supabase.table("good_receive_notes").update({"quality_check_status": "pending"}).eq("id", grn_id).execute()
        
        return JSONResponse(content=created_qc)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating quality check: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create quality check: {str(e)}")

@app.put("/quality-checks/{qc_id}")
def update_quality_check(qc_id: str, qc: dict = Body(...), payload=Depends(require_permission("quality_checks_edit"))):
    """Update a quality check and its items."""
    try:
        fresh_supabase = get_supabase_client()
        
        # Get current QC
        current_qc = fresh_supabase.table("quality_checks").select("id, status, grn_id").eq("id", qc_id).execute()
        if not current_qc.data:
            raise HTTPException(status_code=404, detail="Quality check not found")
        
        current_status = current_qc.data[0]["status"]
        grn_id = current_qc.data[0]["grn_id"]
        
        # Only pending and in_progress QCs can be edited
        if current_status in ["passed", "failed"]:
            raise HTTPException(status_code=403, detail=f"Cannot edit quality check with status '{current_status}'.")
        
        # Update QC record
        qc_data = {
            "inspector_id": qc.get("inspectorId"),
            "qc_date": qc.get("qcDate"),
            "status": qc.get("status", current_status),
            "notes": qc.get("notes")
        }
        # Remove None values
        qc_data = {k: v for k, v in qc_data.items() if v is not None}
        
        result = fresh_supabase.table("quality_checks").update(qc_data).eq("id", qc_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Quality check not found")
        
        updated_qc = result.data[0]
        
        # Handle items update
        items = qc.get("items", [])
        if items:
            # Delete existing items and re-insert
            fresh_supabase.table("quality_check_items").delete().eq("qc_id", qc_id).execute()
            
            items_data = []
            for item in items:
                item_data = {
                    "qc_id": qc_id,
                    "grn_item_id": item["grnItemId"],
                    "product_id": item["productId"],
                    "product_name": item.get("productName", ""),
                    "sku_code": item.get("skuCode", ""),
                    "received_quantity": item.get("receivedQuantity", 0),
                    "inspected_quantity": item.get("inspectedQuantity", 0),
                    "passed_quantity": item.get("passedQuantity", 0),
                    "failed_quantity": item.get("failedQuantity", 0),
                    "failure_reason": item.get("failureReason"),
                    "notes": item.get("notes")
                }
                items_data.append(item_data)
            
            if items_data:
                fresh_supabase.table("quality_check_items").insert(items_data).execute()
        
        # Update GRN quality_check_status based on QC status
        new_status = qc.get("status", current_status)
        qc_status_map = {
            "pending": "pending",
            "in_progress": "pending",
            "passed": "passed",
            "failed": "failed",
            "partial": "partial"
        }
        grn_qc_status = qc_status_map.get(new_status, "pending")
        fresh_supabase.table("good_receive_notes").update({"quality_check_status": grn_qc_status}).eq("id", grn_id).execute()
        
        return JSONResponse(content=updated_qc)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating quality check: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update quality check: {str(e)}")

@app.delete("/quality-checks/{qc_id}")
def delete_quality_check(qc_id: str, payload=Depends(require_permission("quality_checks_delete"))):
    """Delete a quality check (only pending/in_progress)."""
    try:
        fresh_supabase = get_supabase_client()
        
        # Get current QC
        current_qc = fresh_supabase.table("quality_checks").select("id, status, grn_id").eq("id", qc_id).execute()
        if not current_qc.data:
            raise HTTPException(status_code=404, detail="Quality check not found")
        
        current_status = current_qc.data[0]["status"]
        grn_id = current_qc.data[0]["grn_id"]
        
        if current_status not in ["pending", "in_progress"]:
            raise HTTPException(status_code=403, detail=f"Cannot delete quality check with status '{current_status}'. Only pending or in-progress QCs can be deleted.")
        
        # Delete QC (items cascade)
        data = fresh_supabase.table("quality_checks").delete().eq("id", qc_id).execute()
        
        # Reset GRN quality_check_status back to pending
        fresh_supabase.table("good_receive_notes").update({"quality_check_status": "pending"}).eq("id", grn_id).execute()
        
        # Revert GRN status from 'received' back to 'draft' since QC was deleted
        grn_data = fresh_supabase.table("good_receive_notes").select("status").eq("id", grn_id).execute()
        if grn_data.data and grn_data.data[0]["status"] == "received":
            fresh_supabase.table("good_receive_notes").update({"status": "draft"}).eq("id", grn_id).execute()
        
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting quality check: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete quality check: {str(e)}")

# ==================== End Quality Checks API ====================

# ==================== Put Away API ====================

def to_camel_case_put_away(pa):
    """Convert put away data from snake_case to camelCase"""
    return {
        "id": pa.get("id"),
        "putAwayNumber": pa.get("put_away_number"),
        "qualityCheckId": pa.get("quality_check_id"),
        "qualityCheck": {
            "qcNumber": pa.get("quality_checks", {}).get("qc_number"),
            "status": pa.get("quality_checks", {}).get("status"),
        } if pa.get("quality_checks") else None,
        "grnId": pa.get("grn_id"),
        "grn": {
            "grnNumber": pa.get("good_receive_notes", {}).get("grn_number"),
            "status": pa.get("good_receive_notes", {}).get("status"),
        } if pa.get("good_receive_notes") else None,
        "assignedTo": pa.get("assigned_to"),
        "assignedUser": {
            "fullName": pa.get("assigned_user", {}).get("full_name"),
            "username": pa.get("assigned_user", {}).get("username"),
        } if pa.get("assigned_user") else None,
        "status": pa.get("status"),
        "putAwayDate": pa.get("put_away_date"),
        "completedDate": pa.get("completed_date"),
        "notes": pa.get("notes"),
        "items": [to_camel_case_put_away_item(item) for item in pa.get("items", [])],
        "createdBy": pa.get("created_by"),
        "createdAt": pa.get("created_at"),
        "updatedAt": pa.get("updated_at"),
    }

def to_camel_case_put_away_item(item):
    """Convert put away item data from snake_case to camelCase"""
    if not item:
        return {}
    return {
        "id": item.get("id"),
        "putAwayId": item.get("put_away_id"),
        "qualityCheckItemId": item.get("quality_check_item_id"),
        "productId": item.get("product_id"),
        "productName": item.get("product_name"),
        "skuCode": item.get("sku_code"),
        "quantity": float(item.get("quantity") or 0),
        "placedQuantity": float(item.get("placed_quantity") or 0),
        "locationId": item.get("location_id"),
        "locationName": item.get("location_name") or (item.get("locations", {}).get("name") if item.get("locations") else None),
        "batchNumber": item.get("batch_number"),
        "expiryDate": item.get("expiry_date"),
        "notes": item.get("notes"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at"),
    }

@app.get("/put-aways")
def get_put_aways(payload=Depends(require_permission("put_aways_view"))):
    """Get all put aways with related data."""
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("put_aways").select(
            "*, quality_checks(qc_number, status), good_receive_notes(grn_number, status), assigned_user:profiles!put_aways_assigned_to_fkey(full_name, username), items:put_away_items(*, locations(name))"
        ).order("created_at", desc=True).execute()
        
        return JSONResponse(content=[to_camel_case_put_away(pa) for pa in (data.data or [])])
    except Exception as e:
        print(f"Error fetching put aways: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch put aways: {str(e)}")

@app.get("/put-aways/{pa_id}")
def get_put_away(pa_id: str, payload=Depends(require_permission("grn_view"))):
    """Get a single put away with items."""
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("put_aways").select(
            "*, quality_checks(qc_number, status), good_receive_notes(grn_number, status), assigned_user:profiles!put_aways_assigned_to_fkey(full_name, username), items:put_away_items(*, locations(name))"
        ).eq("id", pa_id).execute()
        
        if not data.data:
            raise HTTPException(status_code=404, detail="Put away not found")
        
        return JSONResponse(content=to_camel_case_put_away(data.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching put away: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch put away: {str(e)}")

@app.post("/put-aways")
def create_put_away(pa: dict = Body(...), payload=Depends(require_permission("put_aways_create"))):
    """Create a put away from a quality check."""
    try:
        fresh_supabase = get_supabase_client()
        user_id = payload.get("sub")
        
        qc_id = pa.get("qualityCheckId")
        grn_id = pa.get("grnId")
        
        # Build put away record
        pa_record = {
            "put_away_number": pa.get("putAwayNumber", f"PA-{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "quality_check_id": qc_id,
            "grn_id": grn_id,
            "assigned_to": pa.get("assignedTo"),
            "status": pa.get("status", "pending"),
            "put_away_date": pa.get("putAwayDate", datetime.now().strftime("%Y-%m-%d")),
            "notes": pa.get("notes"),
            "created_by": user_id,
        }
        
        result = fresh_supabase.table("put_aways").insert(pa_record).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create put away record")
        
        pa_id = result.data[0]["id"]
        
        # Insert items if provided
        items = pa.get("items", [])
        if items:
            for item in items:
                item_record = {
                    "put_away_id": pa_id,
                    "quality_check_item_id": item.get("qualityCheckItemId"),
                    "product_id": item.get("productId"),
                    "product_name": item.get("productName"),
                    "sku_code": item.get("skuCode"),
                    "quantity": item.get("quantity", 0),
                    "placed_quantity": item.get("placedQuantity", 0),
                    "location_id": item.get("locationId"),
                    "location_name": item.get("locationName"),
                    "batch_number": item.get("batchNumber"),
                    "expiry_date": item.get("expiryDate"),
                    "notes": item.get("notes"),
                }
                fresh_supabase.table("put_away_items").insert(item_record).execute()
        elif qc_id:
            # Auto-populate from QC passed items
            qc_items = fresh_supabase.table("quality_check_items").select("*").eq("qc_id", qc_id).execute()
            for qi in (qc_items.data or []):
                passed = qi.get("passed_quantity", 0)
                if passed > 0:
                    item_record = {
                        "put_away_id": pa_id,
                        "quality_check_item_id": qi["id"],
                        "product_id": qi.get("product_id"),
                        "product_name": qi.get("product_name"),
                        "sku_code": qi.get("sku_code"),
                        "quantity": passed,
                        "placed_quantity": 0,
                    }
                    fresh_supabase.table("put_away_items").insert(item_record).execute()
        
        # If status is completed on creation, increase stock
        status = pa.get("status", "pending")
        if status == "completed":
            pa_items = fresh_supabase.table("put_away_items").select("*").eq("put_away_id", pa_id).execute()
            for pai in (pa_items.data or []):
                placed_qty = pai.get("placed_quantity", 0) or pai.get("quantity", 0)
                product_id = pai.get("product_id")
                location_id = pai.get("location_id")
                
                if placed_qty > 0 and product_id:
                    if not location_id:
                        default_loc = fresh_supabase.table("locations").select("id").limit(1).execute()
                        location_id = default_loc.data[0]["id"] if default_loc.data else None
                    
                    if location_id:
                        existing = fresh_supabase.table("stock_levels").select("id, quantity_on_hand").eq("product_id", product_id).eq("location_id", location_id).execute()
                        if existing.data:
                            new_qty = (existing.data[0].get("quantity_on_hand", 0) or 0) + placed_qty
                            fresh_supabase.table("stock_levels").update({"quantity_on_hand": new_qty}).eq("id", existing.data[0]["id"]).execute()
                        else:
                            fresh_supabase.table("stock_levels").insert({"product_id": product_id, "location_id": location_id, "quantity_on_hand": placed_qty}).execute()
                        
                        try:
                            fresh_supabase.table("inventory_transactions").insert({
                                "product_id": product_id, "transaction_type": "purchase",
                                "quantity_change": placed_qty, "reference_type": "put_away",
                                "reference_id": pa_id,
                                "notes": f"Put Away {pa_id} completed - stock increased",
                                "created_by": user_id,
                            }).execute()
                        except Exception as tx_err:
                            print(f"Warning: Failed to record inventory transaction: {tx_err}")
                    
                    # Also update product current_stock
                    try:
                        prod = fresh_supabase.table("products").select("current_stock").eq("id", product_id).single().execute()
                        if prod.data:
                            cur = prod.data.get("current_stock", 0) or 0
                            fresh_supabase.table("products").update({"current_stock": cur + placed_qty}).eq("id", product_id).execute()
                            print(f"Stock increased for product {product_id}: {cur} -> {cur + placed_qty}")
                    except Exception as stock_err:
                        print(f"Warning: Failed to update product stock: {stock_err}")
        
        # Fetch and return the created record
        created = fresh_supabase.table("put_aways").select(
            "*, quality_checks(qc_number, status), good_receive_notes(grn_number, status), assigned_user:profiles!put_aways_assigned_to_fkey(full_name, username), items:put_away_items(*, locations(name))"
        ).eq("id", pa_id).execute()
        
        return JSONResponse(content=to_camel_case_put_away(created.data[0]) if created.data else result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating put away: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create put away: {str(e)}")

@app.put("/put-aways/{pa_id}")
def update_put_away(pa_id: str, pa: dict = Body(...), payload=Depends(require_permission("put_aways_edit"))):
    """Update a put away. If status changed to 'completed', increase stock."""
    try:
        fresh_supabase = get_supabase_client()
        
        # Get current put away
        current = fresh_supabase.table("put_aways").select("id, status, grn_id, quality_check_id").eq("id", pa_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Put away not found")
        
        old_status = current.data[0]["status"]
        new_status = pa.get("status", old_status)
        grn_id = current.data[0]["grn_id"]
        
        if old_status == "completed":
            raise HTTPException(status_code=403, detail="Cannot edit a completed put away")
        
        # Update main record
        update_data = {}
        if "assignedTo" in pa:
            update_data["assigned_to"] = pa["assignedTo"]
        if "status" in pa:
            update_data["status"] = pa["status"]
        if "notes" in pa:
            update_data["notes"] = pa["notes"]
        if "putAwayDate" in pa:
            update_data["put_away_date"] = pa["putAwayDate"]
        
        if new_status == "completed":
            update_data["completed_date"] = datetime.now().isoformat()
        
        if update_data:
            fresh_supabase.table("put_aways").update(update_data).eq("id", pa_id).execute()
        
        # Update items
        items = pa.get("items", [])
        for item in items:
            item_id = item.get("id")
            if item_id:
                item_update = {}
                if "placedQuantity" in item:
                    item_update["placed_quantity"] = item["placedQuantity"]
                if "locationId" in item:
                    item_update["location_id"] = item["locationId"]
                if "locationName" in item:
                    item_update["location_name"] = item["locationName"]
                if "notes" in item:
                    item_update["notes"] = item["notes"]
                if item_update:
                    fresh_supabase.table("put_away_items").update(item_update).eq("id", item_id).execute()
        
        # If completing put away — increase stock
        if old_status != "completed" and new_status == "completed":
            pa_items = fresh_supabase.table("put_away_items").select("*").eq("put_away_id", pa_id).execute()
            for pai in (pa_items.data or []):
                placed_qty = pai.get("placed_quantity", 0)
                product_id = pai.get("product_id")
                location_id = pai.get("location_id")
                
                if placed_qty > 0 and product_id:
                    # Use a default location if none specified
                    if not location_id:
                        default_loc = fresh_supabase.table("locations").select("id").limit(1).execute()
                        location_id = default_loc.data[0]["id"] if default_loc.data else None
                    
                    if location_id:
                        # Check existing stock level
                        existing = fresh_supabase.table("stock_levels").select("id, quantity_on_hand").eq("product_id", product_id).eq("location_id", location_id).execute()
                        
                        if existing.data:
                            # Update existing stock
                            new_qty = (existing.data[0].get("quantity_on_hand", 0) or 0) + placed_qty
                            fresh_supabase.table("stock_levels").update({
                                "quantity_on_hand": new_qty
                            }).eq("id", existing.data[0]["id"]).execute()
                        else:
                            # Insert new stock level
                            fresh_supabase.table("stock_levels").insert({
                                "product_id": product_id,
                                "location_id": location_id,
                                "quantity_on_hand": placed_qty,
                            }).execute()
                        
                        # Record inventory transaction
                        try:
                            fresh_supabase.table("inventory_transactions").insert({
                                "product_id": product_id,
                                "transaction_type": "purchase",
                                "quantity_change": placed_qty,
                                "reference_type": "put_away",
                                "reference_id": pa_id,
                                "notes": f"Put Away {pai.get('put_away_id')} completed - stock increased",
                                "created_by": payload.get("sub"),
                            }).execute()
                        except Exception as tx_err:
                            print(f"Warning: Failed to record inventory transaction: {tx_err}")
            
            # Update GRN status to completed
            if grn_id:
                fresh_supabase.table("good_receive_notes").update({"status": "completed"}).eq("id", grn_id).execute()
        
        # Return updated record
        updated = fresh_supabase.table("put_aways").select(
            "*, quality_checks(qc_number, status), good_receive_notes(grn_number, status), assigned_user:profiles!put_aways_assigned_to_fkey(full_name, username), items:put_away_items(*, locations(name))"
        ).eq("id", pa_id).execute()
        
        return JSONResponse(content=to_camel_case_put_away(updated.data[0]) if updated.data else {})
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating put away: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update put away: {str(e)}")

@app.delete("/put-aways/{pa_id}")
def delete_put_away(pa_id: str, payload=Depends(require_permission("put_aways_delete"))):
    """Delete a put away (only pending/in_progress)."""
    try:
        fresh_supabase = get_supabase_client()
        
        current = fresh_supabase.table("put_aways").select("id, status").eq("id", pa_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Put away not found")
        
        current_status = current.data[0]["status"]
        if current_status not in ["pending", "in_progress"]:
            raise HTTPException(status_code=403, detail=f"Cannot delete put away with status '{current_status}'.")
        
        data = fresh_supabase.table("put_aways").delete().eq("id", pa_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting put away: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete put away: {str(e)}")

# ==================== End Put Away API ====================

# ==================== Delivery Challan API ====================

def to_camel_case_delivery_challan(dc):
    """Convert delivery challan data from snake_case to camelCase"""
    return {
        "id": dc.get("id"),
        "dcNumber": dc.get("dc_number"),
        "saleInvoiceId": dc.get("sale_invoice_id"),
        "saleInvoice": {
            "invoiceNumber": dc.get("sale_invoices", {}).get("invoice_number"),
            "status": dc.get("sale_invoices", {}).get("status"),
        } if dc.get("sale_invoices") else None,
        "salesOrderId": dc.get("sales_order_id"),
        "salesOrder": {
            "orderNumber": dc.get("sales_orders", {}).get("order_number"),
            "status": dc.get("sales_orders", {}).get("status"),
        } if dc.get("sales_orders") else None,
        "customerId": dc.get("customer_id"),
        "customer": {
            "name": dc.get("customers", {}).get("name"),
            "phone": dc.get("customers", {}).get("phone"),
            "address": dc.get("customers", {}).get("shipping_address"),
        } if dc.get("customers") else None,
        "status": dc.get("status"),
        "dcDate": dc.get("dc_date"),
        "dispatchDate": dc.get("dispatch_date"),
        "deliveryDate": dc.get("delivery_date"),
        "vehicleNumber": dc.get("vehicle_number"),
        "driverName": dc.get("driver_name"),
        "driverPhone": dc.get("driver_phone"),
        "deliveryAddress": dc.get("delivery_address"),
        "isStandalone": dc.get("is_standalone", False),
        "notes": dc.get("notes"),
        "items": [to_camel_case_delivery_challan_item(i) for i in dc.get("items", [])],
        "createdBy": dc.get("created_by"),
        "createdAt": dc.get("created_at"),
        "updatedAt": dc.get("updated_at"),
    }

def to_camel_case_delivery_challan_item(item):
    """Convert delivery challan item from snake_case to camelCase"""
    return {
        "id": item.get("id"),
        "deliveryChallanId": item.get("delivery_challan_id"),
        "productId": item.get("product_id"),
        "productName": item.get("product_name"),
        "skuCode": item.get("sku_code"),
        "quantity": float(item.get("quantity") or 0),
        "dispatchedQuantity": float(item.get("dispatched_quantity") or 0),
        "unitPrice": float(item.get("unit_price") or 0),
        "notes": item.get("notes"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at"),
    }

@app.get("/delivery-challans")
def get_delivery_challans(payload=Depends(require_permission("delivery_challans_view"))):
    """Get all delivery challans with related data."""
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("delivery_challans").select(
            "*, sale_invoices(invoice_number, status), sales_orders(order_number, status), customers(name, phone, shipping_address), items:delivery_challan_items(*)"
        ).order("created_at", desc=True).execute()

        return JSONResponse(content=[to_camel_case_delivery_challan(dc) for dc in (data.data or [])])
    except Exception as e:
        print(f"Error fetching delivery challans: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch delivery challans: {str(e)}")

@app.get("/delivery-challans/{dc_id}")
def get_delivery_challan(dc_id: str, payload=Depends(require_permission("sale_invoices_view"))):
    """Get a single delivery challan with items."""
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("delivery_challans").select(
            "*, sale_invoices(invoice_number, status), sales_orders(order_number, status), customers(name, phone, shipping_address), items:delivery_challan_items(*)"
        ).eq("id", dc_id).execute()

        if not data.data:
            raise HTTPException(status_code=404, detail="Delivery challan not found")

        return JSONResponse(content=to_camel_case_delivery_challan(data.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching delivery challan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch delivery challan: {str(e)}")

@app.post("/delivery-challans")
def create_delivery_challan(dc: dict = Body(...), payload=Depends(require_permission("delivery_challans_create"))):
    """Create a delivery challan (from invoice, SO, or standalone)."""
    try:
        fresh_supabase = get_supabase_client()
        user_id = payload.get("sub")

        dc_record = {
            "dc_number": dc.get("dcNumber", f"DC-{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "sale_invoice_id": dc.get("saleInvoiceId"),
            "sales_order_id": dc.get("salesOrderId"),
            "customer_id": dc.get("customerId"),
            "status": dc.get("status", "draft"),
            "dc_date": dc.get("dcDate", datetime.now().strftime("%Y-%m-%d")),
            "vehicle_number": dc.get("vehicleNumber"),
            "driver_name": dc.get("driverName"),
            "driver_phone": dc.get("driverPhone"),
            "delivery_address": dc.get("deliveryAddress"),
            "is_standalone": dc.get("isStandalone", False),
            "notes": dc.get("notes"),
            "created_by": user_id,
        }

        result = fresh_supabase.table("delivery_challans").insert(dc_record).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create delivery challan")

        dc_id = result.data[0]["id"]

        # Insert items if provided
        items = dc.get("items", [])
        if items:
            for item in items:
                item_record = {
                    "delivery_challan_id": dc_id,
                    "product_id": item.get("productId"),
                    "product_name": item.get("productName"),
                    "sku_code": item.get("skuCode"),
                    "quantity": item.get("quantity", 0),
                    "dispatched_quantity": item.get("dispatchedQuantity", 0),
                    "unit_price": item.get("unitPrice", 0),
                    "notes": item.get("notes"),
                }
                fresh_supabase.table("delivery_challan_items").insert(item_record).execute()
        elif dc.get("saleInvoiceId"):
            # Auto-populate from sale invoice items
            si_items = fresh_supabase.table("sale_invoice_items").select(
                "*, products(name, sku_code)"
            ).eq("invoice_id", dc.get("saleInvoiceId")).execute()
            for si in (si_items.data or []):
                item_record = {
                    "delivery_challan_id": dc_id,
                    "product_id": si.get("product_id"),
                    "product_name": si.get("product_name") or (si.get("products", {}).get("name") if si.get("products") else None),
                    "sku_code": si.get("sku_code") or (si.get("products", {}).get("sku_code") if si.get("products") else None),
                    "quantity": si.get("quantity", 0),
                    "dispatched_quantity": 0,
                    "unit_price": si.get("unit_price", 0),
                }
                fresh_supabase.table("delivery_challan_items").insert(item_record).execute()

        # Return created record
        created = fresh_supabase.table("delivery_challans").select(
            "*, sale_invoices(invoice_number, status), sales_orders(order_number, status), customers(name, phone, shipping_address), items:delivery_challan_items(*)"
        ).eq("id", dc_id).execute()

        return JSONResponse(content=to_camel_case_delivery_challan(created.data[0]) if created.data else result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating delivery challan: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create delivery challan: {str(e)}")

@app.put("/delivery-challans/{dc_id}")
def update_delivery_challan(dc_id: str, dc: dict = Body(...), payload=Depends(require_permission("sale_invoices_edit"))):
    """Update a delivery challan."""
    try:
        fresh_supabase = get_supabase_client()

        current = fresh_supabase.table("delivery_challans").select("id, status").eq("id", dc_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Delivery challan not found")

        old_status = current.data[0]["status"]
        new_status = dc.get("status", old_status)

        if old_status in ["delivered", "invoiced", "returned"]:
            raise HTTPException(status_code=403, detail=f"Cannot edit delivery challan with status '{old_status}'")

        update_data = {}
        for camel, snake in [
            ("status", "status"), ("vehicleNumber", "vehicle_number"),
            ("driverName", "driver_name"), ("driverPhone", "driver_phone"),
            ("deliveryAddress", "delivery_address"), ("notes", "notes"),
            ("dcDate", "dc_date"), ("customerId", "customer_id"),
        ]:
            if camel in dc:
                update_data[snake] = dc[camel]

        # Track dispatch/delivery dates
        if old_status != "dispatched" and new_status == "dispatched":
            update_data["dispatch_date"] = datetime.now().isoformat()
        if old_status != "delivered" and new_status == "delivered":
            update_data["delivery_date"] = datetime.now().isoformat()

        if update_data:
            fresh_supabase.table("delivery_challans").update(update_data).eq("id", dc_id).execute()

        # Update items
        for item in dc.get("items", []):
            item_id = item.get("id")
            if item_id:
                item_update = {}
                if "dispatchedQuantity" in item:
                    item_update["dispatched_quantity"] = item["dispatchedQuantity"]
                if "notes" in item:
                    item_update["notes"] = item["notes"]
                if item_update:
                    fresh_supabase.table("delivery_challan_items").update(item_update).eq("id", item_id).execute()

        updated = fresh_supabase.table("delivery_challans").select(
            "*, sale_invoices(invoice_number, status), sales_orders(order_number, status), customers(name, phone, shipping_address), items:delivery_challan_items(*)"
        ).eq("id", dc_id).execute()

        return JSONResponse(content=to_camel_case_delivery_challan(updated.data[0]) if updated.data else {})
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating delivery challan: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update delivery challan: {str(e)}")

@app.delete("/delivery-challans/{dc_id}")
def delete_delivery_challan(dc_id: str, payload=Depends(require_permission("sale_invoices_delete"))):
    """Delete a delivery challan (only draft)."""
    try:
        fresh_supabase = get_supabase_client()

        current = fresh_supabase.table("delivery_challans").select("id, status").eq("id", dc_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Delivery challan not found")

        if current.data[0]["status"] != "draft":
            raise HTTPException(status_code=403, detail="Only draft delivery challans can be deleted")

        data = fresh_supabase.table("delivery_challans").delete().eq("id", dc_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting delivery challan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete delivery challan: {str(e)}")

@app.post("/delivery-challans/{dc_id}/convert-to-invoice")
def convert_dc_to_invoice(dc_id: str, payload=Depends(require_permission("sale_invoices_create"))):
    """Convert a standalone DC to a draft Sale Invoice."""
    try:
        fresh_supabase = get_supabase_client()

        # Fetch the DC with items
        dc_data = fresh_supabase.table("delivery_challans").select(
            "*, items:delivery_challan_items(*), customers(name, phone)"
        ).eq("id", dc_id).execute()

        if not dc_data.data:
            raise HTTPException(status_code=404, detail="Delivery Challan not found")

        dc = dc_data.data[0]

        # Validate: must be dispatched or delivered, and not already invoiced
        if dc["status"] in ["draft", "invoiced"]:
            raise HTTPException(status_code=400, detail=f"Cannot convert DC with status '{dc['status']}'. Must be dispatched or delivered.")

        if dc.get("sale_invoice_id"):
            raise HTTPException(status_code=400, detail="This DC is already linked to a Sale Invoice")

        customer_id = dc.get("customer_id")
        if not customer_id:
            raise HTTPException(status_code=400, detail="DC has no customer — cannot create invoice")

        items = dc.get("items", [])
        if not items:
            raise HTTPException(status_code=400, detail="DC has no items")

        user_id = payload.get("sub")

        # Calculate totals from items
        subtotal = 0
        invoice_items = []
        for item in items:
            qty = item.get("dispatched_quantity") or item.get("quantity", 0)
            price = float(item.get("unit_price", 0) or 0)
            line_total = qty * price
            subtotal += line_total

            # Try to get product HSN code
            hsn_code = ""
            product_id = item.get("product_id")
            if product_id:
                try:
                    prod = fresh_supabase.table("products").select("hsn_code").eq("id", product_id).limit(1).execute()
                    if prod.data:
                        hsn_code = prod.data[0].get("hsn_code", "") or ""
                except:
                    pass

            invoice_items.append({
                "product_id": product_id,
                "product_name": item.get("product_name", ""),
                "sku_code": item.get("sku_code", ""),
                "hsn_code": hsn_code,
                "quantity": qty,
                "unit_price": price,
                "discount": 0,
                "tax": 0,
                "sale_tax_type": "exclusive",
                "unit_abbreviation": "",
                "created_by": user_id,
            })

        # Generate invoice number
        invoice_number = f"INV-DC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Create the sale invoice as draft
        invoice_data = {
            "invoice_number": invoice_number,
            "customer_id": customer_id,
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "status": "draft",
            "payment_method": "cash",
            "subtotal": subtotal,
            "tax_amount": 0,
            "discount_amount": 0,
            "total_amount": subtotal,
            "rounding_adjustment": 0,
            "is_direct": True,
            "notes": f"Converted from Delivery Challan {dc.get('dc_number', dc_id)}",
            "created_by": user_id,
            "amount_paid": 0,
            "amount_due": subtotal,
        }

        result = fresh_supabase.table("sale_invoices").insert(invoice_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create sale invoice")

        invoice_id = result.data[0]["id"]

        # Insert invoice items
        for inv_item in invoice_items:
            inv_item["sale_invoice_id"] = invoice_id
            fresh_supabase.table("sale_invoice_items").insert(inv_item).execute()

        # Update DC: link to invoice + set status to invoiced
        fresh_supabase.table("delivery_challans").update({
            "sale_invoice_id": invoice_id,
            "status": "invoiced",
        }).eq("id", dc_id).execute()

        return JSONResponse(content={
            "message": "Successfully converted DC to Sale Invoice",
            "invoiceId": invoice_id,
            "invoiceNumber": invoice_number,
        })
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to convert DC to invoice: {str(e)}")

# ==================== End Delivery Challan API ====================

# ==================== Pick List API ====================

def to_camel_case_pick_list_item(item):
    return {
        "id": item.get("id"),
        "pickListId": item.get("pick_list_id"),
        "productId": item.get("product_id"),
        "productName": item.get("product_name"),
        "skuCode": item.get("sku_code"),
        "quantity": item.get("quantity", 0),
        "pickedQuantity": item.get("picked_quantity", 0),
        "locationId": item.get("location_id"),
        "locationName": item.get("location_name"),
        "notes": item.get("notes"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at"),
    }

def to_camel_case_pick_list(pl):
    return {
        "id": pl.get("id"),
        "pickListNumber": pl.get("pick_list_number"),
        "deliveryChallanId": pl.get("delivery_challan_id"),
        "deliveryChallan": {
            "dcNumber": pl.get("delivery_challans", {}).get("dc_number"),
            "status": pl.get("delivery_challans", {}).get("status"),
        } if pl.get("delivery_challans") else None,
        "assignedTo": pl.get("assigned_to"),
        "assignedUser": {
            "fullName": pl.get("assigned_user", {}).get("full_name"),
            "username": pl.get("assigned_user", {}).get("username"),
        } if pl.get("assigned_user") else None,
        "status": pl.get("status"),
        "pickDate": pl.get("pick_date"),
        "completedDate": pl.get("completed_date"),
        "notes": pl.get("notes"),
        "items": [to_camel_case_pick_list_item(i) for i in pl.get("items", [])],
        "createdBy": pl.get("created_by"),
        "createdAt": pl.get("created_at"),
        "updatedAt": pl.get("updated_at"),
    }

PICK_LIST_SELECT = "*, delivery_challans(dc_number, status), assigned_user:profiles!pick_lists_assigned_to_fkey(full_name, username), items:pick_list_items(*)"

@app.get("/pick-lists")
def get_pick_lists(payload=Depends(require_permission("pick_lists_view"))):
    """Get all pick lists."""
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("pick_lists").select(PICK_LIST_SELECT).order("created_at", desc=True).execute()
        return JSONResponse(content=[to_camel_case_pick_list(pl) for pl in (data.data or [])])
    except Exception as e:
        print(f"Error fetching pick lists: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch pick lists: {str(e)}")

@app.get("/pick-lists/{pl_id}")
def get_pick_list(pl_id: str, payload=Depends(require_permission("sale_invoices_view"))):
    """Get a single pick list."""
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("pick_lists").select(PICK_LIST_SELECT).eq("id", pl_id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Pick list not found")
        return JSONResponse(content=to_camel_case_pick_list(data.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pick list: {str(e)}")


@app.post("/pick-lists")
def create_pick_list(pl: dict = Body(...), payload=Depends(require_permission("pick_lists_create"))):
    """Create a pick list (from DC)."""
    try:
        fresh_supabase = get_supabase_client()
        user_id = payload.get("sub")

        pl_record = {
            "pick_list_number": pl.get("pickListNumber", f"PL-{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "delivery_challan_id": pl.get("deliveryChallanId"),
            "assigned_to": pl.get("assignedTo"),
            "status": pl.get("status", "pending"),
            "pick_date": pl.get("pickDate", datetime.now().strftime("%Y-%m-%d")),
            "notes": pl.get("notes"),
            "created_by": user_id,
        }

        result = fresh_supabase.table("pick_lists").insert(pl_record).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create pick list")

        pl_id = result.data[0]["id"]

        # Insert items if provided
        items = pl.get("items", [])
        if items:
            for item in items:
                fresh_supabase.table("pick_list_items").insert({
                    "pick_list_id": pl_id,
                    "product_id": item.get("productId"),
                    "product_name": item.get("productName"),
                    "sku_code": item.get("skuCode"),
                    "quantity": item.get("quantity", 0),
                    "picked_quantity": item.get("pickedQuantity", 0),
                    "location_id": item.get("locationId"),
                    "location_name": item.get("locationName"),
                    "notes": item.get("notes"),
                }).execute()
        elif pl.get("deliveryChallanId"):
            # Auto-populate from DC items
            dc_items = fresh_supabase.table("delivery_challan_items").select("*").eq("delivery_challan_id", pl.get("deliveryChallanId")).execute()
            for dci in (dc_items.data or []):
                fresh_supabase.table("pick_list_items").insert({
                    "pick_list_id": pl_id,
                    "product_id": dci.get("product_id"),
                    "product_name": dci.get("product_name"),
                    "sku_code": dci.get("sku_code"),
                    "quantity": dci.get("quantity", 0),
                    "picked_quantity": 0,
                }).execute()

        created = fresh_supabase.table("pick_lists").select(PICK_LIST_SELECT).eq("id", pl_id).execute()
        return JSONResponse(content=to_camel_case_pick_list(created.data[0]) if created.data else result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating pick list: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create pick list: {str(e)}")

@app.put("/pick-lists/{pl_id}")
def update_pick_list(pl_id: str, pl: dict = Body(...), payload=Depends(require_permission("pick_lists_edit"))):
    """Update a pick list. If completed, decrease stock and dispatch DC."""
    try:
        fresh_supabase = get_supabase_client()

        current = fresh_supabase.table("pick_lists").select("id, status, delivery_challan_id").eq("id", pl_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Pick list not found")

        old_status = current.data[0]["status"]
        new_status = pl.get("status", old_status)
        dc_id = current.data[0].get("delivery_challan_id")

        if old_status == "completed":
            raise HTTPException(status_code=403, detail="Cannot edit a completed pick list")

        update_data = {}
        for camel, snake in [
            ("status", "status"), ("assignedTo", "assigned_to"),
            ("notes", "notes"), ("pickDate", "pick_date"),
        ]:
            if camel in pl:
                update_data[snake] = pl[camel]

        if new_status == "completed":
            update_data["completed_date"] = datetime.now().isoformat()

        if update_data:
            fresh_supabase.table("pick_lists").update(update_data).eq("id", pl_id).execute()

        # Update items
        for item in pl.get("items", []):
            item_id = item.get("id")
            if item_id:
                item_update = {}
                if "pickedQuantity" in item:
                    item_update["picked_quantity"] = item["pickedQuantity"]
                if "locationId" in item:
                    item_update["location_id"] = item["locationId"]
                if "locationName" in item:
                    item_update["location_name"] = item["locationName"]
                if "notes" in item:
                    item_update["notes"] = item["notes"]
                if item_update:
                    fresh_supabase.table("pick_list_items").update(item_update).eq("id", item_id).execute()

        # If completing — decrease stock
        if old_status != "completed" and new_status == "completed":
            pl_items = fresh_supabase.table("pick_list_items").select("*").eq("pick_list_id", pl_id).execute()
            for pli in (pl_items.data or []):
                picked_qty = pli.get("picked_quantity", 0)
                product_id = pli.get("product_id")
                location_id = pli.get("location_id")

                if picked_qty > 0 and product_id:
                    if location_id:
                        existing = fresh_supabase.table("stock_levels").select("id, quantity_on_hand").eq("product_id", product_id).eq("location_id", location_id).execute()
                    else:
                        existing = fresh_supabase.table("stock_levels").select("id, quantity_on_hand").eq("product_id", product_id).limit(1).execute()

                    if existing.data:
                        new_qty = max(0, (existing.data[0].get("quantity_on_hand", 0) or 0) - picked_qty)
                        fresh_supabase.table("stock_levels").update({
                            "quantity_on_hand": new_qty
                        }).eq("id", existing.data[0]["id"]).execute()

                    # Record inventory transaction
                    try:
                        fresh_supabase.table("inventory_transactions").insert({
                            "product_id": product_id,
                            "transaction_type": "sale",
                            "quantity_change": -picked_qty,
                            "reference_type": "pick_list",
                            "reference_id": pl_id,
                            "notes": f"Pick List completed - stock decreased",
                            "created_by": payload.get("sub"),
                        }).execute()
                    except Exception as tx_err:
                        print(f"Warning: Failed to record inventory transaction: {tx_err}")
                    
                    # Stock sync is handled by on_inventory_transaction trigger
                    pass

            # Update DC status to dispatched
            if dc_id:
                fresh_supabase.table("delivery_challans").update({
                    "status": "dispatched",
                    "dispatch_date": datetime.now().isoformat(),
                }).eq("id", dc_id).execute()

        updated = fresh_supabase.table("pick_lists").select(PICK_LIST_SELECT).eq("id", pl_id).execute()
        return JSONResponse(content=to_camel_case_pick_list(updated.data[0]) if updated.data else {})
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating pick list: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update pick list: {str(e)}")

@app.delete("/pick-lists/{pl_id}")
def delete_pick_list(pl_id: str, payload=Depends(require_permission("pick_lists_delete"))):
    """Delete a pick list (only pending)."""
    try:
        fresh_supabase = get_supabase_client()
        current = fresh_supabase.table("pick_lists").select("id, status").eq("id", pl_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Pick list not found")
        if current.data[0]["status"] not in ["pending", "cancelled"]:
            raise HTTPException(status_code=403, detail="Only pending or cancelled pick lists can be deleted")
        data = fresh_supabase.table("pick_lists").delete().eq("id", pl_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete pick list: {str(e)}")

# ==================== End Pick List API ====================

# ==================== Return Delivery Challan API ====================

def to_camel_case_return_dc_item(item):
    if not item:
        return {}
    return {
        "id": item.get("id"),
        "returnDcId": item.get("return_dc_id"),
        "productId": item.get("product_id"),
        "productName": item.get("product_name"),
        "skuCode": item.get("sku_code"),
        "deliveredQuantity": float(item.get("delivered_quantity") or 0),
        "returnQuantity": float(item.get("return_quantity") or 0),
        "receivedQuantity": float(item.get("received_quantity") or 0),
        "reason": item.get("reason"),
        "condition": item.get("condition", "good"),
        "notes": item.get("notes"),
        "createdAt": item.get("created_at"),
        "updatedAt": item.get("updated_at"),
    }

def to_camel_case_return_dc(rdc):
    return {
        "id": rdc.get("id"),
        "returnDcNumber": rdc.get("return_dc_number"),
        "deliveryChallanId": rdc.get("delivery_challan_id"),
        "deliveryChallan": {
            "dcNumber": rdc.get("delivery_challans", {}).get("dc_number"),
            "status": rdc.get("delivery_challans", {}).get("status"),
        } if rdc.get("delivery_challans") else None,
        "customerId": rdc.get("customer_id"),
        "customer": {
            "name": rdc.get("customers", {}).get("name"),
            "phone": rdc.get("customers", {}).get("phone"),
        } if rdc.get("customers") else None,
        "status": rdc.get("status"),
        "returnDate": rdc.get("return_date"),
        "receivedDate": rdc.get("received_date"),
        "completedDate": rdc.get("completed_date"),
        "reason": rdc.get("reason"),
        "notes": rdc.get("notes"),
        "items": [to_camel_case_return_dc_item(i) for i in rdc.get("items", [])],
        "createdBy": rdc.get("created_by"),
        "createdAt": rdc.get("created_at"),
        "updatedAt": rdc.get("updated_at"),
    }

RETURN_DC_SELECT = "*, delivery_challans(dc_number, status), customers(name, phone), items:return_delivery_challan_items(*)"

@app.get("/return-delivery-challans")
def get_return_dcs(payload=Depends(require_permission("return_delivery_challans_view"))):
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("return_delivery_challans").select(RETURN_DC_SELECT).order("created_at", desc=True).execute()
        return JSONResponse(content=[to_camel_case_return_dc(r) for r in (data.data or [])])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch return DCs: {str(e)}")

@app.get("/return-delivery-challans/{rdc_id}")
def get_return_dc(rdc_id: str, payload=Depends(require_permission("return_delivery_challans_view"))):
    try:
        fresh_supabase = get_supabase_client()
        data = fresh_supabase.table("return_delivery_challans").select(RETURN_DC_SELECT).eq("id", rdc_id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Return DC not found")
        return JSONResponse(content=to_camel_case_return_dc(data.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch return DC: {str(e)}")

@app.post("/return-delivery-challans")
def create_return_dc(rdc: dict = Body(...), payload=Depends(require_permission("return_delivery_challans_create"))):
    try:
        fresh_supabase = get_supabase_client()
        user_id = payload.get("sub")

        record = {
            "return_dc_number": rdc.get("returnDcNumber", f"RDC-{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "delivery_challan_id": rdc.get("deliveryChallanId"),
            "customer_id": rdc.get("customerId"),
            "status": rdc.get("status", "draft"),
            "return_date": rdc.get("returnDate", datetime.now().strftime("%Y-%m-%d")),
            "reason": rdc.get("reason"),
            "notes": rdc.get("notes"),
            "created_by": user_id,
        }

        result = fresh_supabase.table("return_delivery_challans").insert(record).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create return DC")

        rdc_id = result.data[0]["id"]

        items = rdc.get("items", [])
        if items:
            for item in items:
                fresh_supabase.table("return_delivery_challan_items").insert({
                    "return_dc_id": rdc_id,
                    "product_id": item.get("productId"),
                    "product_name": item.get("productName"),
                    "sku_code": item.get("skuCode"),
                    "delivered_quantity": item.get("deliveredQuantity", 0),
                    "return_quantity": item.get("returnQuantity", 0),
                    "received_quantity": item.get("receivedQuantity", 0),
                    "reason": item.get("reason"),
                    "condition": item.get("condition", "good"),
                    "notes": item.get("notes"),
                }).execute()
        elif rdc.get("deliveryChallanId"):
            dc_items = fresh_supabase.table("delivery_challan_items").select("*").eq("delivery_challan_id", rdc.get("deliveryChallanId")).execute()
            for dci in (dc_items.data or []):
                fresh_supabase.table("return_delivery_challan_items").insert({
                    "return_dc_id": rdc_id,
                    "product_id": dci.get("product_id"),
                    "product_name": dci.get("product_name"),
                    "sku_code": dci.get("sku_code"),
                    "delivered_quantity": dci.get("dispatched_quantity") or dci.get("quantity", 0),
                    "return_quantity": 0,
                    "received_quantity": 0,
                    "condition": "good",
                }).execute()

        created = fresh_supabase.table("return_delivery_challans").select(RETURN_DC_SELECT).eq("id", rdc_id).execute()
        return JSONResponse(content=to_camel_case_return_dc(created.data[0]) if created.data else result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create return DC: {str(e)}")

@app.put("/return-delivery-challans/{rdc_id}")
def update_return_dc(rdc_id: str, rdc: dict = Body(...), payload=Depends(require_permission("return_delivery_challans_edit"))):
    """Update return DC. On completion: increase stock for good items, update DC status."""
    try:
        fresh_supabase = get_supabase_client()

        current = fresh_supabase.table("return_delivery_challans").select("id, status, delivery_challan_id").eq("id", rdc_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Return DC not found")

        old_status = current.data[0]["status"]
        new_status = rdc.get("status", old_status)
        dc_id = current.data[0].get("delivery_challan_id")

        if old_status == "completed":
            raise HTTPException(status_code=403, detail="Cannot edit a completed return DC")

        update_data = {}
        for camel, snake in [
            ("status", "status"), ("reason", "reason"), ("notes", "notes"), ("returnDate", "return_date"),
        ]:
            if camel in rdc:
                update_data[snake] = rdc[camel]

        if new_status == "received" and old_status != "received":
            update_data["received_date"] = datetime.now().isoformat()
        if new_status == "completed":
            update_data["completed_date"] = datetime.now().isoformat()

        if update_data:
            fresh_supabase.table("return_delivery_challans").update(update_data).eq("id", rdc_id).execute()

        # Update items
        for item in rdc.get("items", []):
            item_id = item.get("id")
            if item_id:
                item_update = {}
                if "returnQuantity" in item:
                    item_update["return_quantity"] = item["returnQuantity"]
                if "receivedQuantity" in item:
                    item_update["received_quantity"] = item["receivedQuantity"]
                if "reason" in item:
                    item_update["reason"] = item["reason"]
                if "condition" in item:
                    item_update["condition"] = item["condition"]
                if "notes" in item:
                    item_update["notes"] = item["notes"]
                if item_update:
                    fresh_supabase.table("return_delivery_challan_items").update(item_update).eq("id", item_id).execute()

        # On completion — increase stock for good condition items
        if old_status != "completed" and new_status == "completed":
            rdc_items = fresh_supabase.table("return_delivery_challan_items").select("*").eq("return_dc_id", rdc_id).execute()

            total_delivered = 0
            total_returned = 0

            for ri in (rdc_items.data or []):
                received_qty = ri.get("received_quantity", 0)
                product_id = ri.get("product_id")
                condition = ri.get("condition", "good")
                delivered_qty = ri.get("delivered_quantity", 0)
                return_qty = ri.get("return_quantity", 0)

                total_delivered += delivered_qty
                total_returned += return_qty

                # Only add back to stock if condition is good
                if received_qty > 0 and product_id and condition == "good":
                    existing = fresh_supabase.table("stock_levels").select("id, quantity_on_hand").eq("product_id", product_id).limit(1).execute()

                    if existing.data:
                        new_qty = (existing.data[0].get("quantity_on_hand", 0) or 0) + received_qty
                        fresh_supabase.table("stock_levels").update({
                            "quantity_on_hand": new_qty
                        }).eq("id", existing.data[0]["id"]).execute()
                    else:
                        default_loc = fresh_supabase.table("locations").select("id").limit(1).execute()
                        loc_id = default_loc.data[0]["id"] if default_loc.data else None
                        if loc_id:
                            fresh_supabase.table("stock_levels").insert({
                                "product_id": product_id,
                                "location_id": loc_id,
                                "quantity_on_hand": received_qty,
                            }).execute()

                    try:
                        fresh_supabase.table("inventory_transactions").insert({
                            "product_id": product_id,
                            "transaction_type": "return",
                            "quantity_change": received_qty,
                            "reference_type": "return_delivery_challan",
                            "reference_id": rdc_id,
                            "notes": f"Return DC completed - stock increased (condition: {condition})",
                            "created_by": payload.get("sub"),
                        }).execute()
                    except Exception as tx_err:
                        print(f"Warning: Failed to record inventory transaction: {tx_err}")
                    
                    # Stock sync is handled by on_inventory_transaction trigger
                    pass

            # Update DC status
            if dc_id:
                if total_returned >= total_delivered and total_delivered > 0:
                    dc_new_status = "returned"
                else:
                    dc_new_status = "partial_return"
                fresh_supabase.table("delivery_challans").update({"status": dc_new_status}).eq("id", dc_id).execute()

        updated = fresh_supabase.table("return_delivery_challans").select(RETURN_DC_SELECT).eq("id", rdc_id).execute()
        return JSONResponse(content=to_camel_case_return_dc(updated.data[0]) if updated.data else {})
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update return DC: {str(e)}")

@app.delete("/return-delivery-challans/{rdc_id}")
def delete_return_dc(rdc_id: str, payload=Depends(require_permission("return_delivery_challans_delete"))):
    try:
        fresh_supabase = get_supabase_client()
        current = fresh_supabase.table("return_delivery_challans").select("id, status").eq("id", rdc_id).execute()
        if not current.data:
            raise HTTPException(status_code=404, detail="Return DC not found")
        if current.data[0]["status"] not in ["draft", "cancelled"]:
            raise HTTPException(status_code=403, detail="Only draft or cancelled return DCs can be deleted")
        data = fresh_supabase.table("return_delivery_challans").delete().eq("id", rdc_id).execute()
        return JSONResponse(content=data.data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete return DC: {str(e)}")

# ==================== End Return Delivery Challan API ====================

def check_duplicate_ean_code(ean_code: str, exclude_product_id: str = None):
    """Check if EAN code already exists"""
    query = supabase.table("products").select("id").eq("barcode", ean_code)
    if exclude_product_id:
        query = query.neq("id", exclude_product_id)
    data = query.execute()
    return len(data.data) > 0

def update_purchase_order_status_from_grns(purchase_order_id: str):
    """Evaluate cumulative receipts from all completed GRNs for a PO and set PO status.
    - If all PO item quantities are fully received (sum of accepted_quantity >= ordered quantity for each item), set PO to 'received'.
    - Otherwise keep or set status to 'approved' (do not override 'cancelled').
    """
    if DEBUG_MODE:
        print(f"DEBUG: Updating PO status for purchase_order_id: {purchase_order_id}")
    fresh = get_supabase_client()
    # Fetch PO status to avoid overriding cancelled
    po_res = fresh.table("purchase_orders").select("status").eq("id", purchase_order_id).execute()
    if not po_res.data:
        return
    current_status = po_res.data[0]["status"]
    if current_status == "cancelled":
        return
    # Fetch PO items
    poi_res = fresh.table("purchase_order_items").select("id, quantity").eq("purchase_order_id", purchase_order_id).execute()
    po_items = poi_res.data or []
    if not po_items:
        # No items -> mark as received to close out
        fresh.table("purchase_orders").update({"status": "received"}).eq("id", purchase_order_id).execute()
        return
    # Fetch completed GRNs for this PO
    grn_res = fresh.table("good_receive_notes").select("id, status").eq("purchase_order_id", purchase_order_id).execute()
    grn_ids = [g["id"] for g in (grn_res.data or []) if g.get("status") == "completed"]
    if DEBUG_MODE:
        print(f"DEBUG: Found GRNs for PO {purchase_order_id}: {[(g['id'], g['status']) for g in (grn_res.data or [])]}")
        print(f"DEBUG: Completed GRN IDs: {grn_ids}")
    if not grn_ids:
        if DEBUG_MODE:
            print(f"DEBUG: No completed GRNs found for PO {purchase_order_id}")
        if current_status == "received":
            fresh.table("purchase_orders").update({"status": "approved"}).eq("id", purchase_order_id).execute()
        return
    # Sum accepted quantities per PO item across completed GRNs
    items_res = fresh.table("good_receive_note_items").select("purchase_order_item_id, accepted_quantity, received_quantity, rejected_quantity, grn_id").in_("grn_id", grn_ids).execute()
    received_by_item = {}
    if DEBUG_MODE:
        print(f"DEBUG: GRN items data: {items_res.data}")
    for row in items_res.data or []:
        poi = row.get("purchase_order_item_id")
        if not poi:
            if DEBUG_MODE:
                print(f"DEBUG: Skipping GRN item with no purchase_order_item_id: {row}")
            continue
        acc = int(row.get("accepted_quantity") or 0)
        received_by_item[poi] = received_by_item.get(poi, 0) + acc
        if DEBUG_MODE:
            print(f"DEBUG: PO Item {poi}: accepted_quantity={acc}, running_total={received_by_item[poi]}")
    
    if DEBUG_MODE:
        print(f"DEBUG: PO Items: {po_items}")
        print(f"DEBUG: Received by item: {received_by_item}")
    
    # Determine completeness
    all_received = True
    for poi in po_items:
        required = int(poi.get("quantity") or 0)
        got = int(received_by_item.get(poi.get("id"), 0))
        if DEBUG_MODE:
            print(f"DEBUG: PO Item {poi.get('id')}: required={required}, received={got}, satisfied={got >= required}")
        if got < required:
            all_received = False
            # Don't break here, continue logging all items for debugging
    # Update PO status accordingly
    if all_received and current_status != "received":
        if DEBUG_MODE:
            print(f"DEBUG: All items received for PO {purchase_order_id}, updating status to 'received'")
        fresh.table("purchase_orders").update({"status": "received"}).eq("id", purchase_order_id).execute()
    elif not all_received and current_status == "received":
        if DEBUG_MODE:
            print(f"DEBUG: Not all items received for PO {purchase_order_id}, reverting status to 'approved'")
        fresh.table("purchase_orders").update({"status": "approved"}).eq("id", purchase_order_id).execute()
    else:
        if DEBUG_MODE:
            print(f"DEBUG: No status change needed for PO {purchase_order_id}. Current: {current_status}, All received: {all_received}")

# Status validation functions for business logic
def validate_grn_status_transition(current_status: str, new_status: str = None, operation: str = "edit"):
    """Validate GRN status for edit/delete operations"""
    if operation == "edit":
        # For editing: only draft and partial can be edited
        if current_status in ['completed', 'rejected', 'received']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot edit GRN with status '{current_status}'. Only draft and partial GRNs can be edited."
            )
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['partial', 'completed', 'rejected', 'received']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot delete GRN with status '{current_status}'. Only draft GRNs can be deleted."
            )

def validate_sale_invoice_status_transition(current_status: str, new_status: str = None, operation: str = "edit"):
    """Validate Sale Invoice status for edit/delete operations"""
    if operation == "edit":
        # For editing: draft, sent, and partial can be edited
        if current_status in ['paid', 'overdue', 'cancelled']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot edit sale invoice with status '{current_status}'. Only draft, sent, and partial invoices can be edited."
            )
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['sent', 'partial', 'paid', 'overdue', 'cancelled']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot delete sale invoice with status '{current_status}'. Only draft invoices can be deleted."
            )

def validate_credit_note_status_transition(current_status: str, new_status: str = None, operation: str = "edit"):
    """Validate Credit Note status for edit/delete operations"""
    if operation == "edit":
        # For editing: only draft and pending can be edited
        if current_status in ['approved', 'processed', 'cancelled']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot edit credit note with status '{current_status}'. Only draft and pending credit notes can be edited."
            )
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['pending', 'approved', 'processed', 'cancelled']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot delete credit note with status '{current_status}'. Only draft credit notes can be deleted."
            )

def validate_purchase_order_status_transition(current_status: str, new_status: str = None, operation: str = "edit"):
    """Validate Purchase Order status for edit/delete operations"""
    if operation == "edit":
        # For editing: only draft and pending can be edited
        if current_status in ['approved', 'cancelled', 'received']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot edit purchase order with status '{current_status}'. Only draft and pending orders can be edited."
            )
    elif operation == "delete":
        # For deleting: only draft can be deleted
        if current_status in ['pending', 'approved', 'cancelled', 'received']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot delete purchase order with status '{current_status}'. Only draft orders can be deleted."
            )

def validate_sales_order_status_transition(current_status: str, new_status: str = None, operation: str = "edit"):
    """Validate Sales Order status for edit/delete operations"""
    if operation == "edit":
        # For editing: draft, pending, approved, sent, partial, and overdue can be edited
        if current_status in ['fulfilled', 'cancelled']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot edit sales order with status '{current_status}'. Only draft, pending, approved, sent, partial, and overdue orders can be edited."
            )
    elif operation == "delete":
        # For deleting: only draft, pending, and approved can be deleted
        if current_status in ['sent', 'partial', 'fulfilled', 'overdue', 'cancelled']:
            raise HTTPException(
                status_code=403, 
                detail=f"Cannot delete sales order with status '{current_status}'. Only draft, pending, and approved orders can be deleted."
            )

# Customer Payments API Endpoints
@app.get("/customer-payments")
def get_customer_payments(payload=Depends(require_permission("sale_invoices_view"))):
    """Get all customer payments."""
    try:
        data = supabase.table("customer_payments").select("*").order("created_at", desc=True).execute()
        # Transform to camelCase
        transformed_data = [to_camel_case_payment(payment) for payment in data.data]
        return JSONResponse(content=transformed_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/customer-payments/{payment_id}")
def get_customer_payment(payment_id: str, payload=Depends(require_permission("sale_invoices_view"))):
    """Get a specific customer payment."""
    try:
        data = supabase.table("customer_payments").select("*").eq("id", payment_id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Payment not found")
        # Transform to camelCase
        transformed_data = to_camel_case_payment(data.data[0])
        return JSONResponse(content=transformed_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/customer-payments")
def create_customer_payment(payment: dict = Body(...), payload=Depends(require_permission("sale_invoices_edit"))):
    """Create a new customer payment."""
    try:
        # Map camelCase to snake_case
        payment_data = {
            "invoice_id": payment["invoiceId"],
            "customer_id": payment["customerId"],
            "payment_amount": payment["paymentAmount"],
            "payment_date": payment["paymentDate"],
            "payment_method": payment["paymentMethod"],
            "payment_reference": payment.get("paymentReference"),
            "notes": payment.get("notes"),
            "created_by": payload["sub"]
        }

        # Insert the payment
        result = supabase.table("customer_payments").insert(payment_data).execute()
        created_payment = result.data[0] if result.data else None

        if not created_payment:
            raise HTTPException(status_code=500, detail="Failed to create payment")

        # Transform to camelCase before returning
        transformed_payment = to_camel_case_payment(created_payment)
        return JSONResponse(content=transformed_payment, status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/customer-payments/{payment_id}")
def update_customer_payment(payment_id: str, payment: dict = Body(...), payload=Depends(require_permission("sale_invoices_edit"))):
    """Update a customer payment."""
    try:
        # Map camelCase to snake_case
        payment_data = {
            "payment_amount": payment["paymentAmount"],
            "payment_date": payment["paymentDate"],
            "payment_method": payment["paymentMethod"],
            "payment_reference": payment.get("paymentReference"),
            "notes": payment.get("notes"),
            "updated_at": "now()"
        }

        # Update the payment
        result = supabase.table("customer_payments").update(payment_data).eq("id", payment_id).execute()
        updated_payment = result.data[0] if result.data else None

        if not updated_payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        # Transform to camelCase before returning
        transformed_payment = to_camel_case_payment(updated_payment)
        return JSONResponse(content=transformed_payment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/customer-payments/{payment_id}")
def delete_customer_payment(payment_id: str, payload=Depends(require_permission("sale_invoices_edit"))):
    """Delete a customer payment."""
    try:
        result = supabase.table("customer_payments").delete().eq("id", payment_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Payment not found")
        return JSONResponse(content={"message": "Payment deleted successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sale-invoices/{sale_invoice_id}/payments")
def get_invoice_payments(sale_invoice_id: str, payload=Depends(require_permission("sale_invoices_view"))):
    """Get all payments for a specific sale invoice."""
    try:
        data = supabase.table("customer_payments").select("*").eq("invoice_id", sale_invoice_id).order("payment_date", desc=True).execute()
        # Transform to camelCase
        transformed_data = [to_camel_case_payment(payment) for payment in data.data]
        return JSONResponse(content=transformed_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sale-invoices/{sale_invoice_id}/payments")
def add_invoice_payment(sale_invoice_id: str, payment: dict = Body(...), payload=Depends(require_permission("sale_invoices_edit"))):
    """Add a payment to a specific sale invoice."""
    try:
        # Map camelCase to snake_case
        payment_data = {
            "invoice_id": sale_invoice_id,
            "customer_id": payment["customerId"],
            "payment_amount": payment["paymentAmount"],
            "payment_date": payment["paymentDate"],
            "payment_method": payment["paymentMethod"],
            "payment_reference": payment.get("paymentReference"),
            "notes": payment.get("notes"),
            "created_by": payload["sub"]
        }

        # Insert the payment
        result = supabase.table("customer_payments").insert(payment_data).execute()
        created_payment = result.data[0] if result.data else None

        if not created_payment:
            raise HTTPException(status_code=500, detail="Failed to create payment")

        # Transform to camelCase before returning
        transformed_payment = to_camel_case_payment(created_payment)
        return JSONResponse(content=transformed_payment, status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _validate_serials_for_product(product_id: str, serial_numbers: List[str], operation: str = "reserve") -> List[str]:
    """
    Validate that serial numbers exist and are available for the given product.
    
    Args:
        product_id: The product ID
        serial_numbers: List of serial numbers to validate
        operation: The operation being performed ("reserve", "sell", "order")
    
    Returns:
        List of validated serial numbers
    
    Raises:
        HTTPException: If validation fails
    """
    if not serial_numbers:
        return []
    
    # Check if product is serialized
    product_data = supabase.table("products").select("is_serialized").eq("id", product_id).execute()
    if not product_data.data:
        raise HTTPException(status_code=400, detail="Product not found")
    
    product = product_data.data[0]
    if not product.get("is_serialized"):
        # If product is not serialized, no serials should be provided
        if serial_numbers:
            raise HTTPException(status_code=400, detail=f"Product is not serialized, but serial numbers were provided")
        return []
    
    # Validate each serial number exists and is available
    validated_serials = []
    for serial in serial_numbers:
        serial_norm = (serial or "").strip()
        if not serial_norm:
            continue
            
        # Check if serial exists for this product
        serial_data = supabase.table("product_serials").select("id, status").eq("product_id", product_id).eq("serial_number", serial_norm).execute()
        
        if not serial_data.data:
            raise HTTPException(status_code=400, detail=f"Serial number '{serial_norm}' not found for product")
        
        serial_info = serial_data.data[0]
        current_status = serial_info["status"]
        
        # Validate status based on operation
        if operation == "order":
            # For Sales Orders, serials should be available
            if current_status != "available":
                raise HTTPException(status_code=400, detail=f"Serial number '{serial_norm}' is not available (current status: {current_status})")
        elif operation == "reserve":
            # For draft invoices, serials should be available
            if current_status != "available":
                raise HTTPException(status_code=400, detail=f"Serial number '{serial_norm}' is not available (current status: {current_status})")
        elif operation == "sell":
            # For finalized invoices, serials can be available or reserved
            if current_status not in ["available", "reserved"]:
                raise HTTPException(status_code=400, detail=f"Serial number '{serial_norm}' cannot be sold (current status: {current_status})")
        
        validated_serials.append(serial_norm)
    
    # Check if quantity matches serial count
    if validated_serials:
        # This will be validated by the calling function with the actual quantity
        pass
    
    return validated_serials

@app.get("/debug/inventory-transactions")
@require_debug_mode()
def debug_inventory_transactions():
    """Debug endpoint to check inventory transactions"""
    try:
        # Get recent inventory transactions
        transactions = supabase.table("inventory_transactions").select("*").order("created_at", desc=True).limit(10).execute()
        
        # Get recent product_serials changes
        serials = supabase.table("product_serials").select("*").order("updated_at", desc=True).limit(10).execute()
        
        # Get recent sale invoices
        invoices = supabase.table("sale_invoices").select("id, invoice_number, status, created_at").order("created_at", desc=True).limit(5).execute()
        
        return {
            "recent_transactions": transactions.data,
            "recent_serials": serials.data,
            "recent_invoices": invoices.data,
            "total_transactions": len(transactions.data),
            "total_serials": len(serials.data)
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/sales-orders/available")
def get_available_sales_orders_for_invoice(payload=Depends(require_permission("sale_orders_view"))):
    """Get sales orders that are available for invoice creation (no existing invoices)"""
    # Join with customers to get customer names
    data = supabase.table("sales_orders").select("*, customers(*)").execute()
    
    # Filter out orders that already have invoices (draft or sent)
    available_orders = []
    for order in data.data:
        # Only include approved orders (not sent, not cancelled)
        if order["status"] not in ["approved"]:
            continue
            
        # Check if there are any invoices for this sales order
        invoice_check = supabase.table("sale_invoices").select("id, status").eq("sales_order_id", order["id"]).execute()
        
        # Only include orders that have no invoices or only cancelled invoices
        has_active_invoices = any(inv["status"] in ["draft", "sent", "partial", "paid"] for inv in invoice_check.data)
        
        if not has_active_invoices:
            available_orders.append(order)
    
    # Transform to camelCase
    transformed_data = [to_camel_case_sales_order(order) for order in available_orders]
    return JSONResponse(content=transformed_data)


if __name__ == "__main__":
    print(f"Starting server with DEBUG_MODE: {DEBUG_MODE}")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=DEBUG_MODE)


# --- Purchase Indents API Endpoints ---

@app.get("/purchase-indents")
def get_purchase_indents(status: Optional[str] = None, payload=Depends(require_permission("purchase_indents_view"))):
    try:
        client = get_supabase_client()
        query = client.table("purchase_indents").select("*, requester:profiles!requester_id(*)")
        if status:
            query = query.eq("status", status)
        data = query.order("created_at", desc=True).execute()
        
        transformed = [to_camel_case_purchase_indent(indent) for indent in data.data]
        return JSONResponse(content=transformed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching indents: {str(e)}")

@app.get("/purchase-indents/{indent_id}")
def get_purchase_indent(indent_id: str, payload=Depends(require_permission("purchase_indents_view"))):
    try:
        client = get_supabase_client()
        indent_data = client.table("purchase_indents").select("*, requester:profiles!requester_id(*)").eq("id", indent_id).single().execute()
        if not indent_data.data:
            return JSONResponse(content={"error": "Indent not found"}, status_code=404)
            
        items_data = client.table("purchase_indent_items").select("*, product:products(*)").eq("indent_id", indent_id).execute()
        
        indent = to_camel_case_purchase_indent(indent_data.data)
        indent["items"] = [to_camel_case_purchase_indent_item(item) for item in items_data.data]
        
        return JSONResponse(content=indent)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching indent: {str(e)}")

@app.post("/purchase-indents")
def create_purchase_indent(indent: dict = Body(...), payload=Depends(require_permission("purchase_indents_create"))):
    try:
        client = get_supabase_client()
        
        # 1. Create indent header
        indent_data = {
            "indent_number": indent["indentNumber"],
            "requester_id": indent["requesterId"],
            "department": indent.get("department"),
            "required_date": indent["requiredDate"],
            "status": indent.get("status", "draft"),
            "total_estimated_value": indent.get("totalEstimatedValue", 0),
            "notes": indent.get("notes")
        }
        
        header_result = client.table("purchase_indents").insert(indent_data).execute()
        new_indent = header_result.data[0]
        
        # 2. Create items
        items = indent.get("items", [])
        if items:
            items_payload = []
            for item in items:
                items_payload.append({
                    "indent_id": new_indent["id"],
                    "product_id": item["productId"],
                    "quantity": item["quantity"],
                    "estimated_unit_price": item.get("estimatedUnitPrice", 0)
                })
            client.table("purchase_indent_items").insert(items_payload).execute()
            
        return JSONResponse(content=to_camel_case_purchase_indent(new_indent))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating indent: {str(e)}")

@app.put("/purchase-indents/{indent_id}")
def update_purchase_indent(indent_id: str, indent: dict = Body(...), payload=Depends(require_permission("purchase_indents_edit"))):
    try:
        client = get_supabase_client()
        
        # 1. Update header
        update_data = {}
        if "indentNumber" in indent: update_data["indent_number"] = indent["indentNumber"]
        if "department" in indent: update_data["department"] = indent["department"]
        if "requiredDate" in indent: update_data["required_date"] = indent["requiredDate"]
        if "status" in indent: update_data["status"] = indent["status"]
        if "notes" in indent: update_data["notes"] = indent["notes"]
        if "totalEstimatedValue" in indent: update_data["total_estimated_value"] = indent["totalEstimatedValue"]
        
        if update_data:
            client.table("purchase_indents").update(update_data).eq("id", indent_id).execute()
            
        # 2. Update items (Replace all strategy for MVP)
        if "items" in indent:
            client.table("purchase_indent_items").delete().eq("indent_id", indent_id).execute()
            items_payload = []
            for item in indent["items"]:
                items_payload.append({
                    "indent_id": indent_id,
                    "product_id": item["productId"],
                    "quantity": item["quantity"],
                    "estimated_unit_price": item.get("estimatedUnitPrice", 0)
                })
            if items_payload:
                client.table("purchase_indent_items").insert(items_payload).execute()
                
        return JSONResponse(content={"status": "success"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating indent: {str(e)}")

@app.delete("/purchase-indents/{indent_id}")
def delete_purchase_indent(indent_id: str, payload=Depends(require_permission("purchase_indents_delete"))):
    try:
        client = get_supabase_client()
        client.table("purchase_indents").delete().eq("id", indent_id).execute()
        return JSONResponse(content={"status": "success"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting indent: {str(e)}")

@app.post("/purchase-orders/from-indents")
def consolidate_indents(request: dict = Body(...), payload=Depends(require_permission("purchase_orders_create"))):
    """
    Consolidate multiple indents into one Purchase Order.
    Expected body: { indentIds: string[], supplierId: string, orderDate: string, ... }
    """
    try:
        client = get_supabase_client()
        indent_ids = request["indentIds"]
        supplier_id = request["supplierId"]
        
        # 1. Fetch items from all indents
        items_res = client.table("purchase_indent_items") \
            .select("*, indent:purchase_indents(*)") \
            .in_("indent_id", indent_ids) \
            .execute()
        
        all_items = items_res.data
        if not all_items:
            raise HTTPException(status_code=400, detail="No items found in selected indents")
            
        # 2. Consolidate by product
        consolidated = {}
        for it in all_items:
            pid = it["product_id"]
            if pid not in consolidated:
                consolidated[pid] = {
                    "product_id": pid,
                    "quantity": 0,
                    "unit_cost": float(it["estimated_unit_price"] or 0)
                }
            consolidated[pid]["quantity"] += it["quantity"]
            
        # 3. Create PO
        po_number = f"PO-IND-{datetime.now().strftime('%y%m%d%H%M%S')}"
        po_data = {
            "order_number": po_number,
            "supplier_id": supplier_id,
            "order_date": request.get("orderDate", datetime.now().date().isoformat()),
            "status": "draft",
            "notes": f"Consolidated from Indents: {', '.join(indent_ids)}"
        }
        
        po_res = client.table("purchase_orders").insert(po_data).execute()
        new_po = po_res.data[0]
        
        # 4. Create PO Items
        po_items = []
        for pid, data in consolidated.items():
            po_items.append({
                "purchase_order_id": new_po["id"],
                "product_id": pid,
                "quantity": data["quantity"],
                "cost_price": data["unit_cost"], # PO uses cost_price
                "total": data["quantity"] * data["unit_cost"]
            })
        client.table("purchase_order_items").insert(po_items).execute()
        
        # 5. Link back and Update Status
        client.table("purchase_indent_items").update({"purchase_order_id": new_po["id"]}).in_("indent_id", indent_ids).execute()
        client.table("purchase_indents").update({"status": "converted"}).in_("id", indent_ids).execute()
        
        return JSONResponse(content={"status": "success", "purchaseOrderId": new_po["id"]})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consolidating indents: {str(e)}")

# ============================================================
# Backup & Restore Endpoints
# ============================================================

BACKUP_DIR = "/app/backups"

@app.get("/backups")
def get_backups(payload=Depends(require_role(["admin"]))):
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    backups = []
    for filename in os.listdir(BACKUP_DIR):
        if filename.endswith(".sql"):
            filepath = os.path.join(BACKUP_DIR, filename)
            stat = os.stat(filepath)
            
            # Format size nicely
            size_bytes = stat.st_size
            if size_bytes < 1024 * 1024:
                size_str = f"{size_bytes / 1024:.2f} KB"
            else:
                size_str = f"{size_bytes / (1024 * 1024):.2f} MB"
                
            backups.append({
                "id": filename,
                "name": filename,
                "type": "Database",
                "size": size_str,
                "createdAt": datetime.fromtimestamp(stat.st_mtime).isoformat() + "Z",
                "status": "Completed"
            })
            
    # Sort backwards by date
    backups.sort(key=lambda x: x["createdAt"], reverse=True)
    return JSONResponse(content=backups)

@app.post("/backups/create")
def create_backup(payload=Depends(require_role(["admin"]))):
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql"
    filepath = os.path.join(BACKUP_DIR, filename)
    
    # We need to construct the DB URI from the env variables
    # The container api uses POSTGRES_USER=postgres and POSTGRES_PASSWORD=postgres usually
    # It also might be using supabase-db:5432
    # Let's try to infer it from the env vars supplied to the API container
    
    # Or rely on standard supabase-db connection from internal docker network
    db_password = os.environ.get("SUPABASE_DB_PASSWORD", "postgres")
    db_uri = f"postgresql://postgres:{db_password}@supabase-db:5432/postgres"
    
    try:
        # Run pg_dump
        process = subprocess.run(
            ["pg_dump", db_uri, "-f", filepath, "--clean", "--if-exists", "--no-owner"],
            check=True,
            capture_output=True,
            text=True
        )
        return JSONResponse(content={"success": True, "filename": filename})
    except subprocess.CalledProcessError as e:
        print(f"pg_dump failed: {e.stderr}")
        raise HTTPException(status_code=500, detail="Failed to create backup")
        
@app.get("/backups/download/{filename}")
def download_backup(filename: str, payload=Depends(require_role(["admin"]))):
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath) or not filename.endswith(".sql"):
        raise HTTPException(status_code=404, detail="Backup not found")
        
    return FileResponse(filepath, media_type="application/sql", filename=filename)
    
@app.post("/backups/restore/{filename}")
def restore_backup(filename: str, payload=Depends(require_role(["admin"]))):
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath) or not filename.endswith(".sql"):
        raise HTTPException(status_code=404, detail="Backup not found")
        
    db_password = os.environ.get("SUPABASE_DB_PASSWORD", "postgres")
    db_uri = f"postgresql://postgres:{db_password}@supabase-db:5432/postgres"
    
    try:
        process = subprocess.run(
            ["psql", db_uri, "-f", filepath],
            check=True,
            capture_output=True,
            text=True
        )
        return JSONResponse(content={"success": True, "message": "Database restored successfully"})
    except subprocess.CalledProcessError as e:
        print(f"psql restore failed: {e.stderr}")
        raise HTTPException(status_code=500, detail="Failed to restore backup")

@app.delete("/backups/{filename}")
def delete_backup(filename: str, payload=Depends(require_role(["admin"]))):
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath) or not filename.endswith(".sql"):
        raise HTTPException(status_code=404, detail="Backup not found")
        
    os.remove(filepath)
    return JSONResponse(content={"success": True})
