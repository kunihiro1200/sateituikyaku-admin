#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AA13756の座標を正確な値でSupabaseに保存する
展開後URL: https://www.google.co.jp/maps/search/33.318861,+131.488326?...
"""
import urllib.request
import json

def load_env(filepath):
    env = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    env[key.strip()] = value.strip().strip('"').strip("'")
    except Exception as e:
        print(f'Warning: {e}')
    return env

env = load_env('backend/.env')
SUPABASE_URL = env.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = env.get('SUPABASE_SERVICE_KEY', '')

# 展開後URLから取得した正確な座標
lat = 33.318861
lng = 131.488326

print(f'AA13756の座標を正確な値で更新します')
print(f'  lat={lat}, lng={lng}')
print(f'  (別府市亀川四の湯町2区桜台3組)')

url = f'{SUPABASE_URL}/rest/v1/property_listings?property_number=eq.AA13756'
data = json.dumps({'latitude': lat, 'longitude': lng}).encode('utf-8')
req = urllib.request.Request(url, data=data, method='PATCH')
req.add_header('apikey', SUPABASE_SERVICE_KEY)
req.add_header('Authorization', f'Bearer {SUPABASE_SERVICE_KEY}')
req.add_header('Content-Type', 'application/json')
req.add_header('Prefer', 'return=minimal')

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f'✅ 保存完了 (HTTP {resp.status})')
except Exception as e:
    print(f'❌ 保存失敗: {e}')
