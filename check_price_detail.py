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

# 買主7138と7137の詳細を確認
for bn in ['7138', '7137', '906', '2528']:
    url = f"{supabase_url}/rest/v1/buyers?select=buyer_number,price,price_range_house,price_range_apartment,price_range_land,building_name_price&buyer_number=eq.{bn}"
    req = urllib.request.Request(url)
    req.add_header('apikey', supabase_key)
    req.add_header('Authorization', f'Bearer {supabase_key}')
    
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if data:
            row = data[0]
            print(f"買主{bn}: price={row.get('price')}, price_range_house={row.get('price_range_house')}, price_range_apartment={row.get('price_range_apartment')}, building_name_price={row.get('building_name_price')}")
