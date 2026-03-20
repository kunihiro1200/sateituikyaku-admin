#!/usr/bin/env python3
"""AA6のDB状態を確認するスクリプト"""
import urllib.request
import json

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

# AA6を直接検索
url = f"{SUPABASE_URL}/rest/v1/sellers?seller_number=eq.AA6&select=seller_number,deleted_at,status,name,created_at,updated_at"
req = urllib.request.Request(url, headers={
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
})

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print("=== AA6の状態 ===")
        if data:
            for row in data:
                print(f"seller_number: {row.get('seller_number')}")
                print(f"deleted_at: {row.get('deleted_at')}")
                print(f"status: {row.get('status')}")
                print(f"created_at: {row.get('created_at')}")
                print(f"updated_at: {row.get('updated_at')}")
        else:
            print("AA6はDBに存在しません")
except Exception as e:
    print(f"エラー: {e}")

# AA6で始まる売主番号を全件確認（AA6, AA60, AA61...）
url2 = f"{SUPABASE_URL}/rest/v1/sellers?seller_number=like.AA6*&select=seller_number,deleted_at&order=seller_number.asc&limit=60"
req2 = urllib.request.Request(url2, headers={
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
})

try:
    with urllib.request.urlopen(req2) as resp:
        data = json.loads(resp.read())
        print(f"\n=== AA6で始まる売主番号（{len(data)}件） ===")
        for row in data:
            deleted = "削除済み" if row.get('deleted_at') else "有効"
            print(f"  {row.get('seller_number')} [{deleted}]")
except Exception as e:
    print(f"エラー: {e}")
