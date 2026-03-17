import subprocess
import json

# .env.localから環境変数を読み込む
env_vars = {}
try:
    with open('backend/.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                env_vars[key.strip()] = value.strip().strip('"').strip("'")
except:
    pass

try:
    with open('backend/.env', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                if key.strip() not in env_vars:
                    env_vars[key.strip()] = value.strip().strip('"').strip("'")
except:
    pass

supabase_url = env_vars.get('SUPABASE_URL', '')
supabase_key = env_vars.get('SUPABASE_SERVICE_KEY', '')

print(f"SUPABASE_URL: {supabase_url[:30]}..." if supabase_url else "SUPABASE_URL: not found")
print(f"SUPABASE_SERVICE_KEY: {'found' if supabase_key else 'not found'}")

if supabase_url and supabase_key:
    import urllib.request
    
    url = f"{supabase_url}/rest/v1/property_listings?property_number=eq.AA9195&select=property_number,distribution_areas,address"
    req = urllib.request.Request(url)
    req.add_header('apikey', supabase_key)
    req.add_header('Authorization', f'Bearer {supabase_key}')
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"\nAA9195のデータ:")
            for row in data:
                print(f"  property_number: {row.get('property_number')}")
                print(f"  distribution_areas: '{row.get('distribution_areas')}'")
                print(f"  address: {row.get('address')}")
    except Exception as e:
        print(f"エラー: {e}")
