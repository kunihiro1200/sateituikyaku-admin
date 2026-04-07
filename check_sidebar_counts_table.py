#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seller_sidebar_countsテーブルの現在の状態を確認
"""

from supabase import create_client, Client

# Supabase接続
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("seller_sidebar_countsテーブルの確認")
print("=" * 80)
print()

# seller_sidebar_countsテーブルを取得
response = supabase.table('seller_sidebar_counts').select('*').execute()

if not response.data:
    print("❌ seller_sidebar_countsテーブルが空です")
    print()
    print("【解決策】")
    print("1. GASの同期を実行する")
    print("2. または、seller_sidebar_countsテーブルを削除して、getSidebarCountsFallback()を使用する")
else:
    print(f"取得したレコード数: {len(response.data)}")
    print()
    
    # todayCallカテゴリを検索
    today_call_record = next((r for r in response.data if r.get('category') == 'todayCall'), None)
    
    if today_call_record:
        print("【todayCallカテゴリ】")
        print(f"  category: {today_call_record.get('category')}")
        print(f"  count: {today_call_record.get('count')}")
        print(f"  updated_at: {today_call_record.get('updated_at')}")
        print()
        
        if today_call_record.get('count') == 0:
            print("⚠️ todayCallのカウントが0です。")
            print("   これが問題の原因です。")
            print()
            print("【解決策】")
            print("1. seller_sidebar_countsテーブルを削除する")
            print("2. getSidebarCountsFallback()が自動的に使用される")
            print("3. 正しいカウントが計算される")
    else:
        print("❌ todayCallカテゴリが見つかりません")
    
    print()
    print("【全カテゴリ】")
    for record in response.data:
        print(f"  {record.get('category')}: {record.get('count')}")

print()
print("=" * 80)
print("確認完了")
print("=" * 80)
