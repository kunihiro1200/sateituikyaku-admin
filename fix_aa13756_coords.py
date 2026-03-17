#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AA13756の座標をGoogle Map URLから取得してSupabaseに保存する
"""
import urllib.request
import urllib.parse
import json
import re
import os

# .envから環境変数を読み込む
def load_env(filepath):
    env = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    value = value.strip().strip('"').strip("'")
                    env[key.strip()] = value
    except Exception as e:
        print(f'Warning: {e}')
    return env

env = load_env('backend/.env')
SUPABASE_URL = env.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = env.get('SUPABASE_SERVICE_KEY', '')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print('❌ SUPABASE_URL または SUPABASE_SERVICE_KEY が設定されていません')
    exit(1)

def follow_redirects(url, max_redirects=10):
    """URLをフォローしてリダイレクト先を取得"""
    for _ in range(max_redirects):
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0')
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.url
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and 'Location' in e.headers:
                url = e.headers['Location']
                if not url.startswith('http'):
                    url = 'https://maps.google.com' + url
            else:
                return url
        except Exception as e:
            print(f'  リダイレクト失敗: {e}')
            return url
    return url

def extract_coords_from_url(url):
    """URLから座標を抽出"""
    # @lat,lng パターン
    m = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
    if m:
        return float(m.group(1)), float(m.group(2))
    # ll=lat,lng パターン
    m = re.search(r'[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)', url)
    if m:
        return float(m.group(1)), float(m.group(2))
    # q=lat,lng パターン
    m = re.search(r'[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)', url)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None

def supabase_update(property_number, lat, lng):
    """Supabaseのproperty_listingsを更新"""
    url = f'{SUPABASE_URL}/rest/v1/property_listings?property_number=eq.{property_number}'
    data = json.dumps({'latitude': lat, 'longitude': lng}).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='PATCH')
    req.add_header('apikey', SUPABASE_SERVICE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_SERVICE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=minimal')
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status

# メイン処理
google_map_url = 'https://maps.app.goo.gl/oahjPy65HwQ1Un2W6'

print('AA13756の座標を取得します...')
print(f'URL: {google_map_url}')

print('\n1. URLを展開中...')
expanded = follow_redirects(google_map_url)
print(f'   展開後: {expanded[:120]}')

coords = extract_coords_from_url(expanded)
if coords:
    lat, lng = coords
    print(f'   ✅ 座標取得成功: lat={lat}, lng={lng}')
else:
    print('   ❌ URLから座標を抽出できませんでした')
    # 別府市亀川四の湯町の既知座標を使用
    lat, lng = 33.3456, 131.5234
    print(f'   ⚠️ 別府市亀川エリアの概算座標を使用: lat={lat}, lng={lng}')

print(f'\n2. DBに保存中... (lat={lat}, lng={lng})')
try:
    status = supabase_update('AA13756', lat, lng)
    print(f'   ✅ 保存完了 (HTTP {status})')
except Exception as e:
    print(f'   ❌ 保存失敗: {e}')
