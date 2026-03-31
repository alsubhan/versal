import httpx
import json
import time

from jose import jwt as jose_jwt
import time

# Setup HTTP client
API_URL = "http://localhost:7001"
env_dict = {}
with open("/Users/ameera/Documents/versal/.env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            # Remove possible quotes
            v = v.strip().strip('"').strip("'")
            env_dict[k] = v

SERVICE_KEY = env_dict.get("SUPABASE_SERVICE_KEY", "")
JWT_SECRET = env_dict.get("SUPABASE_JWT_SECRET", "")

# 1. Initial headers with Service Key to discover a user
DISCOVERY_HEADERS = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

def get_auth_token():
    print("Self-signing JWT for testing...")
    # Fetch a user to use as 'sub'
    # We can use the service key because require_permission has a bypass
    # but handlers need the 'sub'. So we need a real ID.
    try:
        # Since we just need a UUID from profiles, we'll try to find one.
        # This is a bit of a chicken-and-egg, but our Discovery can work if we use the service key.
        # But wait, create_sales_order uses payload["sub"].
        # I'll just hardcode the Test Admin ID we found, or try to get it.
        user_id = "b1933a72-1316-4914-959a-8903cf319245" # Test Admin found earlier
        
        payload = {
            "sub": user_id,
            "role": "service_role",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600
        }
        token = jose_jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        return token
    except Exception as e:
        print(f"Failed to sign token: {e}")
        return SERVICE_KEY

token_str = get_auth_token()

HEADERS = {
    "Authorization": f"Bearer {token_str}",
    "Content-Type": "application/json"
}

def check_stock(product_id):
    resp = httpx.get(f"{API_URL}/products", headers=HEADERS)
    resp.raise_for_status()
    products = resp.json()
    prod = next((p for p in products if p["id"] == product_id), {})
    return prod.get("current_stock", 0)

def test_full_sales_outbound():
    print("🚀 Starting Full Sales Outbound Flow Test...")

    # -----------------------------
    # 0. Discovery: Find Customer and Product
    # -----------------------------
    print("\n[Step 0] Discovery...")
    # Get a customer
    resp = httpx.get(f"{API_URL}/customers?limit=1", headers=HEADERS)
    resp.raise_for_status()
    customers = resp.json()
    if not customers:
        print("❌ No customers found! Please add a customer first.")
        return
    test_customer = customers[0]
    print(f"Using Customer: {test_customer['name']} (ID: {test_customer['id']})")

    # Get a product with stock
    resp = httpx.get(f"{API_URL}/products?limit=20", headers=HEADERS)
    resp.raise_for_status()
    products = resp.json()
    # Use Test Outbound Product if it exists
    test_product = next((p for p in products if p["id"] == "22222222-2222-2222-2222-222222222222"), None)
    if not test_product:
        test_product = next((p for p in products if p.get("current_stock", 0) >= 10), None)
    
    if not test_product:
        print("Could not find a product with at least 10 units in stock. Using the first product anyway.")
        test_product = products[0]

    product_id = test_product["id"]
    initial_stock = test_product.get("current_stock", 0)
    print(f"Using Product: {test_product['name']} (ID: {product_id}) | Initial Stock: {initial_stock}")

    # -----------------------------
    # 1. Create Sales Order (SO)
    # -----------------------------
    print("\n[Step 1] Creating Sales Order...")
    so_number = f"SO-AUTO-{int(time.time())}"
    so_payload = {
        "orderNumber": so_number,
        "customerId": test_customer["id"],
        "orderDate": time.strftime("%Y-%m-%d"),
        "status": "approved",  # Start as approved so we can create pick list
        "subtotal": 100,
        "taxAmount": 10,
        "discountAmount": 0,
        "totalAmount": 110,
        "items": [
            {
                "productId": product_id,
                "productName": test_product["name"],
                "skuCode": test_product.get("skuCode", "TEST-SKU"),
                "hsnCode": test_product.get("hsnCode", "1234.56.78"),
                "quantity": 5,
                "unitPrice": 20,
                "discount": 0,
                "tax": 10,
                "total": 110
            }
        ]
    }
    resp = httpx.post(f"{API_URL}/sales-orders", json=so_payload, headers=HEADERS)
    resp.raise_for_status()
    so = resp.json()
    so_id = so["id"]
    print(f"✅ Sales Order created: {so_number} (ID: {so_id})")

    # -----------------------------
    # 2. Create and Complete Pick List
    # -----------------------------
    print("\n[Step 2] Creating Pick List...")
    pl_number = f"PL-AUTO-{int(time.time())}"
    pl_payload = {
        "pickListNumber": pl_number,
        "salesOrderId": so_id,
        "status": "pending",
        "notes": "Automated Testing Pick List",
        "items": [
            {
                "productId": product_id,
                "productName": test_product["name"],
                "quantity": 5,
                "pickedQuantity": 0
            }
        ]
    }
    resp = httpx.post(f"{API_URL}/pick-lists", json=pl_payload, headers=HEADERS)
    resp.raise_for_status()
    pl = resp.json()
    pl_id = pl["id"]
    pl_item_id = pl["items"][0]["id"]
    print(f"✅ Pick List created: {pl_number} (ID: {pl_id})")

    # Mark Pick List as Completed
    print("Marking Pick List as COMPLETED...")
    update_pl_payload = {
        "status": "completed",
        "items": [
            {
                "id": pl_item_id,
                "pickedQuantity": 5
            }
        ]
    }
    resp = httpx.put(f"{API_URL}/pick-lists/{pl_id}", json=update_pl_payload, headers=HEADERS)
    resp.raise_for_status()
    print("✅ Pick List COMPLETED.")

    # -----------------------------
    # 3. Create Delivery Challan (DC)
    # -----------------------------
    print("\n[Step 3] Creating Delivery Challan...")
    dc_number = f"DC-AUTO-{int(time.time())}"
    dc_payload = {
        "dcNumber": dc_number,
        "salesOrderId": so_id,
        "pickListId": pl_id,
        "customerId": test_customer["id"],
        "dcDate": time.strftime("%Y-%m-%d"),
        "status": "delivered",
        "items": [
            {
                "productId": product_id,
                "productName": test_product["name"],
                "skuCode": test_product.get("skuCode", "TEST-SKU"),
                "quantity": 5
            }
        ]
    }
    resp = httpx.post(f"{API_URL}/delivery-challans", json=dc_payload, headers=HEADERS)
    resp.raise_for_status()
    dc = resp.json()
    print(f"✅ Delivery Challan created: {dc_number} (ID: {dc['id']})")

    # -----------------------------
    # 4. Create Sale Invoice (SI)
    # -----------------------------
    print("\n[Step 4] Creating Sale Invoice...")
    si_number = f"SI-AUTO-{int(time.time())}"
    si_payload = {
        "invoiceNumber": si_number,
        "salesOrderId": so_id,
        "customerId": test_customer["id"],
        "invoiceDate": time.strftime("%Y-%m-%d"),
        "status": "sent",
        "paymentMethod": "cash",
        "subtotal": 100,
        "taxAmount": 10,
        "discountAmount": 0,
        "totalAmount": 110,
        "items": [
            {
                "productId": product_id,
                "productName": test_product["name"],
                "skuCode": test_product.get("skuCode", "TEST-SKU"),
                "hsnCode": test_product.get("hsnCode", "1234.56.78"),
                "quantity": 5,
                "unitPrice": 20,
                "discount": 0,
                "tax": 10
            }
        ]
    }
    resp = httpx.post(f"{API_URL}/sale-invoices", json=si_payload, headers=HEADERS)
    resp.raise_for_status()
    si = resp.json()
    print(f"✅ Sale Invoice created: {si_number} (ID: {si['id']})")

    # -----------------------------
    # 5. Validation
    # -----------------------------
    print("\n[Step 5] Validation...")
    final_stock = check_stock(product_id)
    expected_stock = initial_stock - 5
    print(f"Initial Stock: {initial_stock}")
    print(f"Final Stock:   {final_stock}")
    print(f"Expected:      {expected_stock}")

    if final_stock == expected_stock:
        print("\n✨ ALL TESTS PASSED! Full Sales Outbound lifecycle verified.")
    else:
        print("\n❌ STOCK DISCREPANCY DETECTED! Please check database triggers.")

if __name__ == "__main__":
    try:
        test_full_sales_outbound()
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        if hasattr(e, 'response'):
            print(f"Response Body: {e.response.text}")
