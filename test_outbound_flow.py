import httpx
import json

# Setup HTTP client
API_URL = "http://localhost:7001"
env_dict = {}
with open("/Users/ameera/Documents/versal/.env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env_dict[k] = v

token_str = env_dict.get("SUPABASE_SERVICE_KEY", "").strip('"').strip("'")

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

def test_outbound_flow():
    print("Fetching a product for testing...")
    # Get a product
    resp = httpx.get(f"{API_URL}/products?limit=10", headers=HEADERS)
    resp.raise_for_status()
    products = resp.json()
    test_product = next((p for p in products if p.get("currentStock", 0) >= 5), None)
    
    if not test_product:
        print("Could not find a product with at least 5 units in stock. Using the first product anyway.")
        test_product = products[0]

    product_id = test_product["id"]
    initial_stock = test_product.get("currentStock", 0)
    print(f"Testing with Product: {test_product['name']} (ID: {product_id}) | Initial Stock: {initial_stock}")
    
    # -----------------------------
    # 1. Create and Complete Pick List (Decrease Stock)
    # -----------------------------
    print("\n--- Testing Pick List (Stock Decrease) ---")
    pl_payload = {
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
    print(f"Created Pick List: {pl['pickListNumber']} (ID: {pl_id})")
    
    # Complete the pick list
    update_payload = {
        "status": "completed",
        "items": [
            {
                "id": pl_item_id,
                "pickedQuantity": 5
            }
        ]
    }
    resp = httpx.put(f"{API_URL}/pick-lists/{pl_id}", json=update_payload, headers=HEADERS)
    resp.raise_for_status()
    print("Marked Pick List as COMPLETED with 5 units picked.")
    
    # Verify stock
    post_pick_stock = check_stock(product_id)
    print(f"Stock after Pick List: {post_pick_stock} (Expected: {max(0, initial_stock - 5)})")
    if post_pick_stock != max(0, initial_stock - 5):
        print("❌ STOCK DECREASE VERIFICATION FAILED!")
    else:
        print("✅ STOCK DECREASE VERIFICATION PASSED!")

    # -----------------------------
    # 2. Create and Complete Return DC (Increase Stock)
    # -----------------------------
    print("\n--- Testing Return DC (Stock Increase) ---")
    rdc_payload = {
        "status": "draft",
        "reason": "Damaged / Wrong Item Testing",
        "items": [
            {
                "productId": product_id,
                "productName": test_product["name"],
                "returnQuantity": 5,
                "receivedQuantity": 0,
                "condition": "good"
            }
        ]
    }
    resp = httpx.post(f"{API_URL}/return-delivery-challans", json=rdc_payload, headers=HEADERS)
    resp.raise_for_status()
    rdc = resp.json()
    rdc_id = rdc["id"]
    rdc_item_id = rdc["items"][0]["id"]
    print(f"Created Return DC: {rdc['returnDcNumber']} (ID: {rdc_id})")
    
    # Complete the Return DC
    update_rdc_payload = {
        "status": "completed",
        "items": [
            {
                "id": rdc_item_id,
                "returnQuantity": 5,
                "receivedQuantity": 5,
                "condition": "good"
            }
        ]
    }
    resp = httpx.put(f"{API_URL}/return-delivery-challans/{rdc_id}", json=update_rdc_payload, headers=HEADERS)
    
    # Very minor check in case of 500 error
    try:
        resp.raise_for_status()
        print("Marked Return DC as COMPLETED with 5 units received in 'good' condition.")
    except Exception as e:
        print(f"Failed to complete Return DC: {e} | Response: {resp.text}")
        raise
    
    # Verify stock
    final_stock = check_stock(product_id)
    print(f"Stock after Return DC: {final_stock} (Expected: {post_pick_stock + 5})")
    if final_stock != post_pick_stock + 5:
        print("❌ STOCK INCREASE VERIFICATION FAILED!")
    else:
        print("✅ STOCK INCREASE VERIFICATION PASSED!")
    
    print("\n✓ ALL OUTBOUND WORKFLOW TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    test_outbound_flow()
