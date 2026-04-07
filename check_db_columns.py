#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sellersテーブルの全カラム名を確認するスクリプト
"""

import os
from supabase import create_client, Client

# Supabase接続
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("sellersテーブルのカラム名確認")
print("=" * 80)
print()

# AA13224のデータを取得
response = supabase.table('sellers').select('*').eq('seller_number', 'AA13224').execute()

if response.data:
    seller = response.data[0]
    print("AA13224の全フィールド:")
    print()
    
    # 状況に関連するフィールドを探す
    status_fields = []
    for key, value in seller.items():
        if 'status' in key.lower() or 'situation' in key.lower() or '状況' in str(key):
            status_fields.append((key, value))
    
    print("【状況関連フィールド】")
    for key, value in status_fields:
        print(f"  {key}: {value}")
    
    print()
    print("【全フィールド一覧】（アルファベット順）")
    for key in sorted(seller.keys()):
        value = seller[key]
        if value is not None and value != '':
            print(f"  {key}: {value}")
else:
    print("AA13224が見つかりません")

print()
print("=" * 80)
