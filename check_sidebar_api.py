import urllib.request, json

env = {}
for fname in ['backend/.env.local', 'backend/.env', 'backend/.env.production']:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    k = k.strip().strip('"')
                    v = v.strip().strip('"')
                    if k not in env:
                        env[k] = v
    except:
        pass

base_url = env.get('SUPABASE_URL', '').strip('"')
key = env.get('SUPABASE_SERVICE_KEY', env.get('SUPABASE_ANON_KEY', '')).strip('"')

# seller_sidebar_countsの全データを確認
url = base_url + '/rest/v1/seller_sidebar_counts?select=category,count,label,assignee&order=category'
req = urllib.request.Request(url, headers={
    'apikey': key,
    'Authorization': 'Bearer ' + key,
})
try:
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
        print('seller_sidebar_counts all:')
        for row in data:
            print(f"  {row}")
except Exception as e:
    print('Error:', e)
