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

# seller_sidebar_countsのpinrichEmptyを確認
url = base_url + '/rest/v1/seller_sidebar_counts?category=eq.pinrichEmpty&select=category,count'
req = urllib.request.Request(url, headers={
    'apikey': key,
    'Authorization': 'Bearer ' + key,
})
try:
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
        print('seller_sidebar_counts pinrichEmpty:', data)
except Exception as e:
    print('Error:', e)

# AA13966のデータを直接確認
url2 = base_url + '/rest/v1/sellers?seller_number=eq.AA13966&select=seller_number,status,pinrich_status,inquiry_date,visit_assignee,next_call_date'
req2 = urllib.request.Request(url2, headers={
    'apikey': key,
    'Authorization': 'Bearer ' + key,
})
try:
    with urllib.request.urlopen(req2) as r:
        data2 = json.loads(r.read())
        print('AA13966 data:', data2)
except Exception as e:
    print('Error2:', e)

# Pinrich空欄条件に合う売主を確認（追客中 + pinrich_status空 + inquiry_date >= 2026-01-01 + visit_assignee空）
url3 = base_url + '/rest/v1/sellers?status=ilike.*%25%E8%BF%BD%E5%AE%A2*&pinrich_status=is.null&inquiry_date=gte.2026-01-01&select=seller_number,status,pinrich_status,inquiry_date,visit_assignee&limit=10'
req3 = urllib.request.Request(url3, headers={
    'apikey': key,
    'Authorization': 'Bearer ' + key,
})
try:
    with urllib.request.urlopen(req3) as r:
        data3 = json.loads(r.read())
        print('Pinrich空欄候補 (最大10件):', data3)
except Exception as e:
    print('Error3:', e)
