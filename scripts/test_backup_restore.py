import requests
import os
import json
from jose import jwt
from dotenv import load_dotenv
import time

load_dotenv()

# Configuration
API_URL = "http://localhost:8000"  # Assuming backend is running on 8000
JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")

if not JWT_SECRET:
    print("❌ JWT_SECRET not found in environment")
    exit(1)

def get_service_token():
    payload = {
        "role": "service_role",
        "sub": "test-admin",
        "exp": int(time.time()) + 3600
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def test_backup_flow():
    token = get_service_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print("🔍 Testing GET /backups...")
    resp = requests.get(f"{API_URL}/backups", headers=headers)
    if resp.status_code == 200:
        print(f"✅ Success: Found {len(resp.json())} backups")
    else:
        print(f"❌ Failed: {resp.status_code} - {resp.text}")
        return

    print("🔍 Testing POST /backups/create...")
    resp = requests.post(f"{API_URL}/backups/create", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        filename = data.get("filename")
        print(f"✅ Success: Created backup {filename}")
        
        # Test download
        print(f"🔍 Testing GET /backups/download/{filename}...")
        dl_resp = requests.get(f"{API_URL}/backups/download/{filename}", headers=headers)
        if dl_resp.status_code == 200:
            print(f"✅ Success: Downloaded {len(dl_resp.content)} bytes")
        else:
            print(f"❌ Failed download: {dl_resp.status_code}")

        # Test delete
        print(f"🔍 Testing DELETE /backups/{filename}...")
        del_resp = requests.delete(f"{API_URL}/backups/{filename}", headers=headers)
        if del_resp.status_code == 200:
            print("✅ Success: Deleted backup")
        else:
            print(f"❌ Failed delete: {del_resp.status_code}")
    else:
        print(f"❌ Failed create: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    try:
        test_backup_flow()
    except Exception as e:
        print(f"❌ Error: {str(e)}")
