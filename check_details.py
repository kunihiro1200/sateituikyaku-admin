import urllib.request, json, re

with open('backend/.env', encoding='utf-8') as f:
    content = f.read()
url = re.search(r'SUPABASE_URL=(.+)', content).group(1).strip()
key = re.search(r'SUPABASE_SERVICE_KEY=(.+)', content).group(1).strip()

req = urllib.request.Request(
    url + '/rest/v1/property_previews?order=created_at.desc&limit=1&select=slug,details',
    headers={'apikey': key, 'Authorization': 'Bearer ' + key}
)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read())
    for d in data:
        print('全detailsキー:')
        for k, v in d.get('details', {}).items():
            print(f'  {k}: {str(v)[:80]}')
