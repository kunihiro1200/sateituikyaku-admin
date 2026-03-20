import json
import urllib.request
import os

env_path = os.path.join('backend', '.env')
env_vars = {}
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                env_vars[key.strip()] = value.strip().strip('"').strip("'")

supabase_url = env_vars.get('SUPABASE_URL', '')
supabase_key = env_vars.get('SUPABASE_SERVICE_KEY', '')

url = f"{supabase_url}/rest/v1/buyers?select=buyer_number,price,building_name_price&price=not.is.null&order=price.asc"
req = urllib.request.Request(url)
req.add_header('apikey', supabase_key)
req.add_header('Authorization', f'Bearer {supabase_key}')

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

print(f"priceに値がある買主: {len(data)}件")

def to_num(v):
    try:
        return float(v)
    except:
        return None

small = [r for r in data if to_num(r.get('price')) is not None and to_num(r['price']) < 10000]
large = [r for r in data if to_num(r.get('price')) is not None and to_num(r['price']) >= 10000]

print(f"\n10000未満（万円単位の可能性）: {len(small)}件")
for r in small[:10]:
    print(f"  {r['buyer_number']}: price={r['price']}, building={str(r.get('building_name_price', ''))[:60]}")

print(f"\n10000以上（円単位の可能性）: {len(large)}件")
for r in large[:10]:
    print(f"  {r['buyer_number']}: price={r['price']}, building={str(r.get('building_name_price', ''))[:60]}")
