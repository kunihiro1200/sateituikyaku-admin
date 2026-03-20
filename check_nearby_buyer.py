import os
import sys

# Supabase接続情報を.env.localから読み込む
env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

SUPABASE_URL = (env.get('SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('VITE_SUPABASE_URL')).strip('"').strip("'")
SUPABASE_KEY = (env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_ANON_KEY') or env.get('VITE_SUPABASE_ANON_KEY')).strip('"').strip("'")

print(f'URL: {SUPABASE_URL}')
print(f'KEY: {SUPABASE_KEY[:20] if SUPABASE_KEY else None}...')

import urllib.request
import json

def supabase_get(table, params=''):
    url = f'{SUPABASE_URL}/rest/v1/{table}?{params}'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    })
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

# AA13800の売主データを取得
print('\n=== AA13800の売主データ ===')
sellers = supabase_get('sellers', 'seller_number=eq.AA13800&select=seller_number,property_address,address')
for s in sellers:
    print(f'  seller_number: {s.get("seller_number")}')
    print(f'  property_address: {s.get("property_address")}')
    print(f'  address: {s.get("address")}')

# 買主6935のデータを取得（全カラム）
print('\n=== 買主6935のデータ ===')
buyers = supabase_get('buyers', 'buyer_number=eq.6935&select=*')
for b in buyers:
    for k, v in b.items():
        if v is not None and v != '' and v != []:
            print(f'  {k}: {v}')
