import os
from supabase import create_client

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
client = create_client(supabase_url, supabase_key)
data = client.table("put_aways").select("*, items:put_away_items(*)").limit(1).execute()
print(data.data)
