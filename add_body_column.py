import urllib.request
import urllib.error
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

# Supabase SQL実行エンドポイント
sql = "ALTER TABLE property_report_history ADD COLUMN IF NOT EXISTS body TEXT;"

url = f"{supabase_url}/rest/v1/rpc/exec_sql"
data = json.dumps({"sql": sql}).encode('utf-8')

req = urllib.request.Request(
    url,
    data=data,
    headers={
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json',
    },
    method='POST'
)

try:
    with urllib.request.urlopen(req) as response:
        result = response.read().decode()
        print(f"Success: {result}")
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f"HTTP Error {e.code}: {error_body}")
    print("=> exec_sql RPC not available, trying direct SQL via pg endpoint...")
    
    # 別の方法: Supabase Management APIを使う
    # まずはバックエンドのtsスクリプトを作成して実行する
    print("\nCreating migration script...")
