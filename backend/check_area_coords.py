import urllib.request
import json
import re

# .envから読み込む
env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

url = env.get('SUPABASE_URL', '')
key = env.get('SUPABASE_SERVICE_KEY', '')

print(f"URL: {url}")

# area_map_configから⑨⑩⑭を取得
import urllib.parse
areas = urllib.parse.quote('in.(⑨,⑩,⑭)')
api_url = f"{url}/rest/v1/area_map_config?area_number={areas}&select=area_number,google_map_url,coordinates&order=area_number"

req = urllib.request.Request(
    api_url,
    headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

for row in data:
    print(f"\nエリア: {row['area_number']}")
    print(f"Google Map URL: {row.get('google_map_url', 'なし')}")
    coords = row.get('coordinates')
    if coords:
        if isinstance(coords, str):
            coords = json.loads(coords)
        lat = coords.get('lat')
        lng = coords.get('lng')
        print(f"座標: lat={lat}, lng={lng}")
        print(f"確認URL: https://www.google.com/maps?q={lat},{lng}")
    else:
        print("座標: なし")
