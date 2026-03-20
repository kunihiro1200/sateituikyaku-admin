import json
import urllib.request
import os

# .envファイルを読み込む
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

# 複数の買主のproperty_typeとdesired_property_typeを確認
url = f"{supabase_url}/rest/v1/buyers?select=buyer_number,property_type,desired_property_type,price,price_range_house,price_range_apartment,price_range_land&order=buyer_number.desc&limit=20"
req = urllib.request.Request(url)
req.add_header('apikey', supabase_key)
req.add_header('Authorization', f'Bearer {supabase_key}')
req.add_header('Content-Type', 'application/json')

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print("=== 最新20件の買主データ ===")
    print(f"{'番号':<8} {'property_type':<15} {'desired_property_type':<20} {'price':<15} {'price_range_house':<20}")
    print("-" * 80)
    for row in data:
        print(f"{str(row.get('buyer_number', '')):<8} {str(row.get('property_type', '') or ''):<15} {str(row.get('desired_property_type', '') or ''):<20} {str(row.get('price', '') or ''):<15} {str(row.get('price_range_house', '') or ''):<20}")

# property_typeに値がある買主を確認
print("\n=== property_typeに値がある買主（最新10件）===")
url2 = f"{supabase_url}/rest/v1/buyers?select=buyer_number,property_type,desired_property_type&property_type=not.is.null&order=buyer_number.desc&limit=10"
req2 = urllib.request.Request(url2)
req2.add_header('apikey', supabase_key)
req2.add_header('Authorization', f'Bearer {supabase_key}')
req2.add_header('Content-Type', 'application/json')

with urllib.request.urlopen(req2) as response:
    data2 = json.loads(response.read().decode())
    for row in data2:
        print(f"  {row.get('buyer_number')}: property_type={row.get('property_type')}, desired_property_type={row.get('desired_property_type')}")
