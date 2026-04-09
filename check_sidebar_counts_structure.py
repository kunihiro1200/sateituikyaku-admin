#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seller_sidebar_countsテーブルの構造を確認
"""

from supabase import create_client, Client

# Supabaseクライアントを作成
url: str = "https://krxhrbtlgfjzsseegaqq.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
supabase: Client = create_client(url, key)

print("=" * 75)
print("seller_sidebar_countsテーブルの構造を確認")
print("=" * 75)
print()

# 最初の1件を取得してカラム名を確認
response = supabase.table('seller_sidebar_counts').select('*').limit(1).execute()

if len(response.data) > 0:
    record = response.data[0]
    print("カラム名:")
    for key in record.keys():
        print(f"  - {key}: {record[key]}")
else:
    print("レコードが見つかりませんでした")

print()
print("=" * 75)
