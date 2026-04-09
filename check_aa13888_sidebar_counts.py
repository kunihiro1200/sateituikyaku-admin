#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AA13888がseller_sidebar_countsテーブルに含まれているか確認するスクリプト
タスク1.1.3: AA13888が含まれているか確認
"""

import os
from supabase import create_client, Client

# Supabase接続
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("タスク1.1.3: AA13888がseller_sidebar_countsテーブルに含まれているか確認")
print("=" * 80)
print()

# ステップ1: sellersテーブルでAA13888のIDを取得
print("【ステップ1】sellersテーブルでAA13888のデータを確認")
print("-" * 80)

seller_response = supabase.table('sellers').select('*').eq('seller_number', 'AA13888').execute()

if not seller_response.data:
    print("❌ AA13888が見つかりません")
    exit(1)

seller = seller_response.data[0]
seller_id = seller.get('id')

print(f"✅ AA13888が見つかりました")
print(f"  seller_id: {seller_id}")
print(f"  seller_number: {seller.get('seller_number')}")
print(f"  visit_date (訪問日): {seller.get('visit_date')}")
print(f"  visit_assignee (営担): {seller.get('visit_assignee')}")
print(f"  visit_reminder_assignee (訪問前日通知担当): {seller.get('visit_reminder_assignee')}")
print()

# ステップ2: seller_sidebar_countsテーブルの構造を確認
print("【ステップ2】seller_sidebar_countsテーブルの構造を確認")
print("-" * 80)
print("注: seller_sidebar_countsテーブルは個別の売主IDを保存せず、")
print("    カテゴリーごとの集計カウントのみを保存しています。")
print()

# visitDayBeforeカテゴリーのレコードを確認
print("【ステップ3】visitDayBeforeカテゴリーのレコードを確認")
print("-" * 80)

visit_day_before_response = supabase.table('seller_sidebar_counts').select('*').eq('category', 'visitDayBefore').execute()

if not visit_day_before_response.data:
    print(f"❌ visitDayBeforeカテゴリーのレコードが見つかりません")
else:
    print(f"✅ visitDayBeforeカテゴリーのレコードが見つかりました")
    print(f"  レコード数: {len(visit_day_before_response.data)}")
    print()
    
    for i, record in enumerate(visit_day_before_response.data, 1):
        print(f"  【レコード {i}】")
        print(f"    id: {record.get('id')}")
        print(f"    category: {record.get('category')}")
        print(f"    count: {record.get('count')}")
        print(f"    label: {record.get('label')}")
        print(f"    assignee: {record.get('assignee')}")
        print(f"    updated_at: {record.get('updated_at')}")
        print()

print()

# ステップ4: isVisitDayBefore()関数の判定ロジックをシミュレーション
print("【ステップ4】isVisitDayBefore()関数の判定ロジックをシミュレーション")
print("-" * 80)

visit_date = seller.get('visit_date')
visit_assignee = seller.get('visit_assignee')
visit_reminder_assignee = seller.get('visit_reminder_assignee')

print(f"AA13888の訪問日: {visit_date if visit_date else '空欄（null）'}")
print(f"AA13888の営担: {visit_assignee if visit_assignee else '空欄（null）'}")
print(f"AA13888の訪問前日通知担当: {visit_reminder_assignee if visit_reminder_assignee else '空欄（null）'}")
print()

# isVisitDayBefore()の判定条件
# 1. 営担（visitAssignee）に入力がある
has_visit_assignee = visit_assignee and str(visit_assignee).strip() != ''
print(f"1. 営担に入力がある: {has_visit_assignee}")

# 2. 訪問日（visitDate）が存在する
has_visit_date = visit_date is not None and str(visit_date).strip() != ''
print(f"2. 訪問日が存在する: {has_visit_date}")

# 3. visitReminderAssigneeが空（通知担当が未割り当て）
is_reminder_empty = not visit_reminder_assignee or str(visit_reminder_assignee).strip() == ''
print(f"3. 訪問前日通知担当が空: {is_reminder_empty}")

# 4. 今日が訪問日の前営業日である（この判定は省略）
print(f"4. 今日が訪問日の前営業日である: （判定省略）")

print()
print("【判定結果】")
if not has_visit_assignee:
    print("❌ 営担が空なので、isVisitDayBefore()はfalseを返します")
elif not has_visit_date:
    print("❌ 訪問日が空なので、isVisitDayBefore()はfalseを返します")
elif not is_reminder_empty:
    print("❌ 訪問前日通知担当に値があるので、isVisitDayBefore()はfalseを返します")
else:
    print("✅ 条件1-3を満たしています（条件4は日付次第）")

print()

# ステップ5: 判定結果のまとめ
print("【ステップ5】判定結果のまとめ")
print("-" * 80)

if not visit_date:
    print("❌ 訪問日が空欄なので、visitDayBeforeカテゴリーに含まれるべきではありません")
    
    if visit_day_before_response.data:
        visit_day_before_count = visit_day_before_response.data[0].get('count', 0)
        print(f"⚠️  しかし、seller_sidebar_countsテーブルには count={visit_day_before_count} が記録されています")
        print()
        print("【考えられる原因】")
        print("  1. AA13888以外の売主が訪問日前日の条件を満たしている")
        print("  2. カウント計算ロジックが isVisitDayBefore() と一致していない")
        print("  3. 訪問日が空欄の売主が誤ってカウントされている")
        print()
        print("【次のステップ】")
        print("  - 訪問日が空欄の売主がカウントされていないか確認する（タスク1.1.4）")
        print("  - isVisitDayBefore()関数でフィルタリングして実際の件数を確認する")
    else:
        print("✅ seller_sidebar_countsテーブルにもvisitDayBeforeカテゴリーのレコードがありません（整合性OK）")
else:
    print(f"✅ 訪問日が設定されています: {visit_date}")
    print("   → isVisitDayBefore()関数で判定する必要があります")

print()
print("=" * 80)
print("確認完了")
print("=" * 80)
