import os
import json
import urllib.request
import urllib.parse

# .env.local から環境変数を読み込む
env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, val = line.partition('=')
            env[key.strip()] = val.strip().strip('"').strip("'")

supabase_url = env.get('SUPABASE_URL', '')
service_key = env.get('SUPABASE_SERVICE_ROLE_KEY', '') or env.get('SUPABASE_SERVICE_KEY', '')

if not supabase_url or not service_key:
    print('環境変数が見つかりません')
    print('Keys found:', list(env.keys()))
    exit(1)

url = f"{supabase_url}/rest/v1/sellers?seller_number=eq.AA13806&select=seller_number,visit_assignee,visit_date,visit_reminder_assignee"
req = urllib.request.Request(url, headers={
    'apikey': service_key,
    'Authorization': f'Bearer {service_key}',
    'Content-Type': 'application/json'
})

with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    print(json.dumps(data, ensure_ascii=False, indent=2))
