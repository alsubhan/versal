import os
from supabase import create_client

url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

try:
    from dotenv import load_dotenv
    load_dotenv()
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
except:
    pass

print(f"URL: {url}, KEY: {'SET' if key else 'UNSET'}")

if url and key:
    supabase = create_client(url, key)
    res = supabase.table("user_settings").select("id").limit(1).execute()
    print("Table exists:", res)
else:
    print("Cannot connect.")

