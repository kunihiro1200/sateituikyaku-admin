import os
import urllib.request
import json
from pathlib import Path

# .env.local を読み込む
env_path = Path(__file__).parent / '.env.local'
with open(env_path, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            value = value.strip()
            if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            os.environ[key.strip()] = value

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = (
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or
    os.environ.get('SUPABASE_SERVICE_KEY') or
    os.environ.get('SUPABASE_ANON_KEY', '')
)

print('URL:', SUPABASE_URL)
print('KEY_LEN:', len(SUPABASE_KEY))
print('KEY_START:', SUPABASE_KEY[:30])
print('KEY_END:', SUPABASE_KEY[-10:])

# テストリクエスト
url = f"{SUPABASE_URL}/rest/v1/sellers?select=id&limit=1"
headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        print('SUCCESS:', resp.read()[:100])
except urllib.error.HTTPError as e:
    print('ERROR:', e.code, e.read().decode('utf-8')[:200])
