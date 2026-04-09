#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク2.2: AA13888のデータを確認し、訪問日が空欄の場合はseller_sidebar_countsから削除
"""

from supabase import create_client, Client

# Supabaseクライアントを作成
url: str = "https://krxhrbtlgfjzsseegaqq.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
supabase: Client = create_client(url, key)

print("=" * 75)
print("タスク2.2: AA13888のデータを確認")
print("=" * 75)
print()

# サブタスク2.2.1: sellersテーブルでAA13888の訪問日を確認
print("【サブタスク2.2.1】sellersテーブルでAA13888の訪問日を確認")
print()

response = supabase.table('sellers').select(
    'id, seller_number, visit_date, visit_assignee, visit_reminder_assignee'
).eq('seller_number', 'AA13888').is_('deleted_at', None).execute()

if len(response.data) == 0:
    print("❌ AA13888が見つかりませんでした")
    exit(1)

seller = response.data[0]
seller_id = seller['id']

print(f"売主番号: {seller['seller_number']}")
print(f"売主ID: {seller_id}")
print(f"訪問日: {seller['visit_date']}")
print(f"営担: {seller['visit_assignee']}")
print(f"訪問前日通知担当: {seller['visit_reminder_assignee']}")
print()

# サブタスク2.2.2: 訪問日が空欄の場合、visitDayBeforeカテゴリーのカウントを確認・修正
if seller['visit_date'] is None or seller['visit_date'] == '':
    print("【サブタスク2.2.2】訪問日が空欄のため、visitDayBeforeカテゴリーのカウントを確認")
    print()
    
    # visitDayBeforeカテゴリーのレコードを確認
    sidebar_response = supabase.table('seller_sidebar_counts').select(
        'id, category, label, count, assignee'
    ).eq('category', 'visitDayBefore').execute()
    
    if len(sidebar_response.data) > 0:
        print(f"visitDayBeforeカテゴリーのレコードが見つかりました:")
        for record in sidebar_response.data:
            print(f"  - ID: {record['id']}, Category: {record['category']}, Label: {record['label']}, Count: {record['count']}, Assignee: {record['assignee']}")
        print()
        
        # 訪問日が空欄の売主を確認
        print("訪問日が空欄の売主を確認中...")
        null_visit_date_response = supabase.table('sellers').select(
            'id, seller_number, visit_date, visit_assignee'
        ).is_('deleted_at', None).is_('visit_date', None).execute()
        
        null_visit_date_count = len(null_visit_date_response.data)
        print(f"訪問日が空欄の売主: {null_visit_date_count}件")
        
        if null_visit_date_count > 0:
            print()
            print("【最初の5件を表示】")
            for i, s in enumerate(null_visit_date_response.data[:5], 1):
                print(f"  {i}. {s['seller_number']} (訪問日: {s['visit_date']}, 営担: {s['visit_assignee']})")
        
        print()
        print("【判定】")
        print("AA13888は訪問日が空欄なので、visitDayBeforeカテゴリーに含まれるべきではありません。")
        print("seller_sidebar_countsテーブルは集計テーブルなので、個別の売主を削除することはできません。")
        print()
        print("【推奨される対応】")
        print("1. SellerSidebarCountsUpdateServiceを実行して、カウントを再計算する")
        print("2. または、visitDayBeforeカテゴリーのカウントを手動で0に更新する")
        print()
        
        # カウントを0に更新するか確認
        print("注意: このスクリプトではカウントの更新は行いません。")
        print("      カウント更新はSellerSidebarCountsUpdateServiceで行ってください。")
    else:
        print("visitDayBeforeカテゴリーのレコードは見つかりませんでした")
else:
    print(f"✅ 訪問日が設定されています: {seller['visit_date']}")
    print("visitDayBeforeカテゴリーのカウント確認は不要です")

print()
print("=" * 75)
print("タスク2.2完了")
print("=" * 75)
