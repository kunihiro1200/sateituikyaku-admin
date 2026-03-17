import json
import urllib.request

# .env.localから環境変数を読み込む
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

# property_listingsのdistribution_areasを確認
url = f"{supabase_url}/rest/v1/property_listings?property_number=eq.AA9195&select=property_number,distribution_areas,address"
req = urllib.request.Request(url)
req.add_header('apikey', supabase_key)
req.add_header('Authorization', f'Bearer {supabase_key}')

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    print("property_listings:")
    for row in data:
        for k, v in row.items():
            print(f"  {k}: '{v}'")

print()

# distribution_areasの文字コードを確認
for row in data:
    da = row.get('distribution_areas') or ''
    print(f"distribution_areas bytes: {da.encode('utf-8') if da else 'empty'}")
    # 丸数字を抽出
    import re
    nums = re.findall(r'[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶]', da)
    print(f"丸数字: {nums}")
