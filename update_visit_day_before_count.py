#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visitDayBeforeカテゴリーのカウントを0に更新
"""

from supabase import create_client, Client

# Supabaseクライアントを作成
url: str = "https://krxhrbtlgfjzsseegaqq.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
supabase: Client = create_client(url, key)

print("=" * 75)
print("visitDayBeforeカテゴリーのカウントを0に更新")
print("=" * 75)
print()

# 現在のカウントを確認
print("【ステップ1】現在のカウントを確認")
response = supabase.table('seller_sidebar_counts').select(
    'id, category, count, label, assignee'
).eq('category', 'visitDayBefore').execute()

if len(response.data) == 0:
    print("❌ visitDayBeforeカテゴリーのレコードが見つかりませんでした")
    exit(1)

record = response.data[0]
print(f"現在のカウント: {record['count']}")
print(f"ID: {record['id']}")
print(f"Label: {record['label']}")
print(f"Assignee: {record['assignee']}")
print()

# カウントを0に更新
print("【ステップ2】カウントを0に更新")
update_response = supabase.table('seller_sidebar_counts').update({
    'count': 0
}).eq('category', 'visitDayBefore').execute()

print(f"✅ visitDayBeforeカテゴリーのカウントを0に更新しました")
print()

# 更新後のカウントを確認
print("【ステップ3】更新後のカウントを確認")
verify_response = supabase.table('seller_sidebar_counts').select(
    'id, category, count, label, assignee'
).eq('category', 'visitDayBefore').execute()

if len(verify_response.data) > 0:
    verify_record = verify_response.data[0]
    print(f"更新後のカウント: {verify_record['count']}")
    print(f"✅ カウントが正しく更新されました")
else:
    print("❌ 更新後のレコードが見つかりませんでした")

print()
print("=" * 75)
print("更新完了")
print("=" * 75)
