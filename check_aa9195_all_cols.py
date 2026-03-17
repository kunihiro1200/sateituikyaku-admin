import json
import urllib.request

env_vars = {}
for fname in ['backend/.env.local', 'backend/.env']:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
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

# 全カラムを取得
url = f"{supabase_url}/rest/v1/property_listings?property_number=eq.AA9195&select=*"
req = urllib.request.Request(url)
req.add_header('apikey', supabase_key)
req.add_header('Authorization', f'Bearer {supabase_key}')

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    for row in data:
        print("AA9195の全カラム:")
        for k, v in sorted(row.items()):
            if v is not None and v != '' and v != 0:
                print(f"  {k}: {repr(v)}")
        print()
        print("distribution関連カラム:")
        for k, v in sorted(row.items()):
            if 'distribut' in k.lower() or 'area' in k.lower():
                print(f"  {k}: {repr(v)}")
