#!/usr/bin/env python3
"""
seller_sidebar_countsテーブルの最終更新時刻を確認
"""
import os
from supabase import create_client

# Supabaseクライアント初期化
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

print("=" * 60)
print("seller_sidebar_counts テーブルの最終更新時刻確認")
print("=" * 60)

# visitDayBeforeカテゴリの最終更新時刻を確認
response = supabase.table('seller_sidebar_counts') \
    .select('*') \
    .eq('category', 'visitDayBefore') \
    .execute()

if response.data:
    for row in response.data:
        print(f"\nカテゴリ: {row['category']}")
        print(f"カウント: {row['count']}")
        print(f"最終更新: {row['updated_at']}")
else:
    print("\n❌ visitDayBeforeカテゴリが見つかりません")

# 全カテゴリの最終更新時刻を確認
print("\n" + "=" * 60)
print("全カテゴリの最終更新時刻")
print("=" * 60)

response = supabase.table('seller_sidebar_counts') \
    .select('category, count, updated_at') \
    .order('updated_at', desc=True) \
    .limit(10) \
    .execute()

if response.data:
    for row in response.data:
        print(f"{row['category']:30s} | カウント: {row['count']:3d} | 更新: {row['updated_at']}")
else:
    print("\n❌ データが見つかりません")

print("\n" + "=" * 60)
print("現在時刻との比較")
print("=" * 60)

from datetime import datetime, timezone
now = datetime.now(timezone.utc)
print(f"現在時刻（UTC）: {now.isoformat()}")

if response.data and len(response.data) > 0:
    latest = response.data[0]
    latest_time = datetime.fromisoformat(latest['updated_at'].replace('Z', '+00:00'))
    diff = now - latest_time
    print(f"最終更新からの経過時間: {diff.total_seconds() / 60:.1f}分")
