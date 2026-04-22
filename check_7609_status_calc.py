#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
7609のステータス計算をシミュレートするスクリプト
fetchBuyersForSidebarCountsが返すデータを再現して確認
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# fetchBuyersForSidebarCountsが取得するカラムと同じものを取得
SIDEBAR_COLUMNS = [
    'buyer_number', 'reception_date', 'latest_viewing_date', 'viewing_date',
    'next_call_date', 'follow_up_assignee', 'initial_assignee', 'latest_status',
    'inquiry_confidence', 'inquiry_email_phone', 'inquiry_email_reply',
    'three_calls_confirmed', 'broker_inquiry', 'inquiry_source',
    'viewing_result_follow_up', 'viewing_unconfirmed', 'viewing_type_general',
    'post_viewing_seller_contact', 'notification_sender', 'valuation_survey',
    'valuation_survey_confirmed', 'broker_survey', 'vendor_survey', 'day_of_week',
    'pinrich', 'email', 'pinrich_500man_registration', 'email_confirmed',
    'email_confirmation_assignee', 'viewing_promotion_not_needed',
    'viewing_promotion_sender', 'past_buyer_list', 'property_number',
]

res = supabase.table('buyers').select(', '.join(SIDEBAR_COLUMNS)).eq('buyer_number', '7609').execute()
b = res.data[0]

print("=== fetchBuyersForSidebarCountsが取得する7609のデータ ===\n")
for col in SIDEBAR_COLUMNS:
    val = b.get(col)
    if val is not None and val != '':
        print(f"  {col}: '{val}'")

print()

# property_listingsからatbb_statusを取得して結合
prop_num = b.get('property_number')
p_res = supabase.table('property_listings').select('property_number, atbb_status').eq('property_number', prop_num).execute()
atbb = p_res.data[0].get('atbb_status') if p_res.data else None

print(f"=== property_listingsから結合後 ===")
print(f"  atbb_status: '{atbb}'")
print()

# BuyerStatusCalculatorの条件を手動でシミュレート
print("=== Priority判定シミュレーション ===\n")

# Priority 1
if b.get('valuation_survey') and not b.get('valuation_survey_confirmed'):
    print("→ Priority 1: 査定アンケート回答あり")
    exit()

# Priority 2
if b.get('vendor_survey') == '未':
    print("→ Priority 2: 業者問合せあり")
    exit()

# Priority 3 (簡略化)
if b.get('viewing_date') and not b.get('notification_sender'):
    print(f"  Priority 3候補: viewing_date={b.get('viewing_date')}, notification_sender={b.get('notification_sender')}")
    # notification_senderが'R'なので除外
    print("  → notification_senderが入力済みのためスキップ")

# Priority 4
if b.get('viewing_unconfirmed') == '未確定':
    print("→ Priority 4: 内覧未確定")
    exit()

# Priority 5
inq_phone = b.get('inquiry_email_phone')
inq_reply = b.get('inquiry_email_reply')
latest_viewing = b.get('latest_viewing_date')
if inq_phone == '未' or inq_reply == '未' or (not latest_viewing and inq_phone == '不要' and (inq_reply == '未' or not inq_reply)):
    print(f"→ Priority 5: 問合メール未対応 (inquiry_email_phone={inq_phone}, inquiry_email_reply={inq_reply})")
    exit()
print(f"  Priority 5スキップ: inquiry_email_phone={inq_phone}, inquiry_email_reply={inq_reply}")

# Priority 7
if b.get('three_calls_confirmed') == '3回架電未' and inq_phone in ['不通', '未']:
    print("→ Priority 7: 3回架電未")
    exit()

# Priority 8 条件A
from datetime import date, datetime, timezone
today = date.today()

def is_past(d):
    if not d: return False
    if isinstance(d, str):
        try:
            dt = datetime.fromisoformat(d.replace('Z', '+00:00'))
            return dt.date() < today
        except:
            return False
    return False

def is_after_or_equal(d, threshold):
    if not d: return False
    if isinstance(d, str):
        try:
            dt = datetime.fromisoformat(d.replace('Z', '+00:00'))
            return dt.date() >= date.fromisoformat(threshold)
        except:
            return False
    return False

def contains(s, sub):
    if not s: return False
    return sub in str(s)

viewing_type = b.get('viewing_type_general')
latest_viewing = b.get('latest_viewing_date')
post_contact = b.get('post_viewing_seller_contact')

cond_a = (
    viewing_type and viewing_type.strip() != '' and
    latest_viewing and latest_viewing.strip() != '' and
    is_past(latest_viewing) and
    is_after_or_equal(latest_viewing, '2025-08-01') and
    (not post_contact or post_contact.strip() == '') and
    contains(atbb, '公開中')
)

cond_b = (
    post_contact == '未' and
    contains(atbb, '公開中')
)

print(f"\n  Priority 8 条件A:")
print(f"    viewing_type_general非空: {bool(viewing_type and viewing_type.strip())}")
print(f"    latest_viewing_date非空: {bool(latest_viewing and latest_viewing.strip() if latest_viewing else False)}")
print(f"    latest_viewing_date過去: {is_past(latest_viewing)}")
print(f"    latest_viewing_date>=2025-08-01: {is_after_or_equal(latest_viewing, '2025-08-01')}")
print(f"    post_viewing_seller_contact空欄: {not post_contact or post_contact.strip() == ''}")
print(f"    atbb_status contains '公開中': {contains(atbb, '公開中')}")
print(f"    → 条件A: {cond_a}")

print(f"\n  Priority 8 条件B:")
print(f"    post_viewing_seller_contact='未': {post_contact == '未'}")
print(f"    atbb_status contains '公開中': {contains(atbb, '公開中')}")
print(f"    → 条件B: {cond_b}")

if cond_a or cond_b:
    print(f"\n✅ → Priority 8: 一般媒介_内覧後売主連絡未 に該当")
else:
    print(f"\n❌ → Priority 8に該当しない")
    print(f"\n  続けてPriority 9以降を確認...")
    
    # Priority 9〜15
    follow_up = b.get('follow_up_assignee')
    viewing_result = b.get('viewing_result_follow_up')
    broker = b.get('broker_inquiry')
    
    cond_9_15 = (
        follow_up and
        latest_viewing and is_past(latest_viewing) and
        (not viewing_result or viewing_result.strip() == '') and
        contains(atbb, '公開中') and
        broker != '業者問合せ'
    )
    print(f"\n  Priority 9-15 (担当者別_内覧後未入力):")
    print(f"    follow_up_assignee非空: {bool(follow_up)}")
    print(f"    latest_viewing_date過去: {is_past(latest_viewing)}")
    print(f"    viewing_result_follow_up空欄: {not viewing_result or viewing_result.strip() == ''}")
    print(f"    atbb_status contains '公開中': {contains(atbb, '公開中')}")
    print(f"    broker_inquiry != '業者問合せ': {broker != '業者問合せ'}")
    print(f"    → 条件: {cond_9_15}")
