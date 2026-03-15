import subprocess
import json
import os

# .envファイルを読み込む
env_vars = {}
env_path = 'backend/.env'
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

# requests を使ってSupabase REST APIを呼び出す
try:
    import urllib.request
    import urllib.error
    
    # bodyカラムが存在するか確認
    url = f"{supabase_url}/rest/v1/property_report_history?select=body&limit=1"
    req = urllib.request.Request(url, headers={
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
    })
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"body column EXISTS: {data}")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"HTTP Error {e.code}: {error_body}")
        if 'column' in error_body.lower() and 'body' in error_body.lower():
            print("=> body column does NOT exist, need to add it")
        else:
            print("=> Other error")
except Exception as e:
    print(f"Error: {e}")
