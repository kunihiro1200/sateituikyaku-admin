import subprocess
import json
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

print(f"SUPABASE_URL: {supabase_url[:30]}..." if supabase_url else "SUPABASE_URL: not found")
print(f"SUPABASE_SERVICE_KEY: {'found' if supabase_key else 'not found'}")

# supabaseライブラリを使ってクエリ
try:
    from supabase import create_client
    client = create_client(supabase_url, supabase_key)
    
    result = client.table('buyers').select(
        'buyer_number, property_type, desired_property_type, price, price_range_house, price_range_apartment, price_range_land, budget, property_number'
    ).eq('buyer_number', '2528').single().execute()
    
    data = result.data
    print("\n=== 買主2528のデータ ===")
    print(f"buyer_number: {data.get('buyer_number')}")
    print(f"property_type: {data.get('property_type')}")
    print(f"desired_property_type: {data.get('desired_property_type')}")
    print(f"price: {data.get('price')}")
    print(f"price_range_house: {data.get('price_range_house')}")
    print(f"price_range_apartment: {data.get('price_range_apartment')}")
    print(f"price_range_land: {data.get('price_range_land')}")
    print(f"budget: {data.get('budget')}")
    print(f"property_number: {data.get('property_number')}")
    
except ImportError:
    print("supabase library not found, trying requests...")
    import urllib.request
    
    url = f"{supabase_url}/rest/v1/buyers?buyer_number=eq.2528&select=buyer_number,property_type,desired_property_type,price,price_range_house,price_range_apartment,price_range_land,budget,property_number"
    req = urllib.request.Request(url)
    req.add_header('apikey', supabase_key)
    req.add_header('Authorization', f'Bearer {supabase_key}')
    req.add_header('Content-Type', 'application/json')
    
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if data:
            row = data[0]
            print("\n=== 買主2528のデータ ===")
            for key in ['buyer_number', 'property_type', 'desired_property_type', 'price', 'price_range_house', 'price_range_apartment', 'price_range_land', 'budget', 'property_number']:
                print(f"{key}: {row.get(key)}")
        else:
            print("No data found for buyer 2528")
