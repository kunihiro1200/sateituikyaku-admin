import urllib.request, json

with open('backend/.env.production', 'r', encoding='utf-8') as f:
    env = {}
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

supabase_url = env.get('SUPABASE_URL', '')
supabase_key = env.get('SUPABASE_SERVICE_KEY', '')
print('URL:', supabase_url[:50])

req_url = supabase_url + '/rest/v1/property_listings?property_number=eq.AA13287&select=property_number,current_status,viewing_key'
req = urllib.request.Request(req_url, headers={
    'apikey': supabase_key,
    'Authorization': 'Bearer ' + supabase_key
})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())
    print(json.dumps(data, ensure_ascii=False, indent=2))
