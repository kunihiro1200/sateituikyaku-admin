import os, json, urllib.request, re

env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

SUPABASE_URL = env.get('SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
SUPABASE_KEY = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_ANON_KEY') or env.get('VITE_SUPABASE_ANON_KEY')

def supabase_get(table, params=''):
    from urllib.parse import quote
    url = f'{SUPABASE_URL}/rest/v1/{table}?{quote(params, safe="=&.,*")}'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Range': '0-999',
    })
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

# desired_area に含まれる全ての囲み数字を収集
buyers = supabase_get('buyers', 'select=buyer_number,desired_area&limit=1000')

all_chars = set()
for b in buyers:
    area = b.get('desired_area') or ''
    for ch in area:
        cp = ord(ch)
        # 囲み数字っぽい文字（U+2460以降）
        if cp >= 0x2460:
            all_chars.add(ch)

print('=== desired_area に含まれる囲み数字一覧 ===')
sorted_chars = sorted(all_chars, key=ord)
for ch in sorted_chars:
    print(f'  {ch}  U+{ord(ch):04X}')

# 現在の正規表現で抽出できないもの
current_pattern = re.compile(r'[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]')
missing = [ch for ch in sorted_chars if not current_pattern.match(ch)]
print(f'\n=== 現在の正規表現で抽出できない文字 ===')
for ch in missing:
    print(f'  {ch}  U+{ord(ch):04X}')
