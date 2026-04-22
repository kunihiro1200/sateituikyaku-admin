#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
buyer_sidebar_countsテーブルの現在値を確認するスクリプト
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("=== buyer_sidebar_counts テーブルの現在値 ===\n")

res = supabase.table('buyer_sidebar_counts').select('*').execute()
if res.data:
    for row in res.data:
        print(f"  category={row.get('category')}, assignee={row.get('assignee')}, count={row.get('count')}, updated_at={row.get('updated_at')}")
else:
    print("❌ テーブルが空です")

print()
print("=== 7609が「一般媒介_内覧後売主連絡未」に該当するか手動チェック ===\n")

# 7609のデータ
b_res = supabase.table('buyers').select('buyer_number, property_number, post_viewing_seller_contact, latest_viewing_date, viewing_type_general').eq('buyer_number', '7609').execute()
b = b_res.data[0]
prop_num = b.get('property_number')

# 物件のatbb_statusを取得
p_res = supabase.table('property_listings').select('property_number, atbb_status').eq('property_number', prop_num).execute()
atbb = p_res.data[0].get('atbb_status') if p_res.data else None

print(f"post_viewing_seller_contact: '{b.get('post_viewing_seller_contact')}'")
print(f"atbb_status (from property_listings): '{atbb}'")
print()

# 条件B: post_viewing_seller_contact = '未' AND contains(atbb_status, '公開中')
cond_b = b.get('post_viewing_seller_contact') == '未' and atbb and '公開中' in atbb
print(f"条件B (post_viewing_seller_contact='未' AND atbb_status contains '公開中'): {cond_b}")
print()
if cond_b:
    print("✅ 7609は「一般媒介_内覧後売主連絡未」に該当するはずです")
    print("→ サイドバーカウントが古いキャッシュを使っている可能性があります")
else:
    print("❌ 7609は条件Bを満たしていません")
