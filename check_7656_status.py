#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
7656のステータス計算をシミュレートするスクリプト
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import date, datetime, timezone, timedelta

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

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
    'price',
]

res = supabase.table('buyers').select(', '.join(SIDEBAR_COLUMNS)).eq('buyer_number', '7656').execute()
if not res.data:
    print("7656が見つかりません")
    exit()

b = res.data[0]

print("=== 7656のデータ ===\n")
for col in SIDEBAR_COLUMNS:
    val = b.get(col)
    if val is not None and val != '':
        print(f"  {col}: '{val}'")

print()

# JST今日
jst_now = datetime.now(timezone(timedelta(hours=9)))
today_str = jst_now.strftime('%Y-%m-%d')
print(f"=== 今日（JST）: {today_str} ===\n")

# next_call_date確認
ncd = b.get('next_call_date')
if ncd:
    ncd_str = ncd[:10]
    print(f"next_call_date: {ncd_str}")
    print(f"今日以前か: {ncd_str <= today_str}")
else:
    print("next_call_date: 空欄")

follow_up = b.get('follow_up_assignee')
print(f"follow_up_assignee: '{follow_up}'")
print()

# Priority判定
def is_blank(v):
    return v is None or str(v).strip() == ''

def is_not_blank(v):
    return not is_blank(v)

def is_today_or_past(d):
    if not d: return False
    return d[:10] <= today_str

def is_past(d):
    if not d: return False
    return d[:10] < today_str

def contains(s, sub):
    if not s: return False
    return sub in str(s)

def equals(a, b_val):
    return str(a or '') == str(b_val or '')

print("=== Priority判定 ===\n")

# Priority 3: 内覧日前日
viewing_date = b.get('viewing_date')
notification_sender = b.get('notification_sender')
if is_not_blank(viewing_date) and is_blank(notification_sender):
    print(f"→ Priority 3候補: viewing_date={viewing_date}, notification_sender={notification_sender}")

# Priority 4: 内覧未確定
if equals(b.get('viewing_unconfirmed'), '未確定'):
    print("→ Priority 4: 内覧未確定 ← ここで止まっている可能性")

# Priority 8: 一般媒介_内覧後売主連絡未
atbb = b.get('atbb_status')
viewing_type = b.get('viewing_type_general')
latest_viewing = b.get('latest_viewing_date')
post_contact = b.get('post_viewing_seller_contact')

cond_a = (
    is_not_blank(viewing_type) and
    is_not_blank(latest_viewing) and
    is_past(latest_viewing) and
    latest_viewing[:10] >= '2025-08-01' and
    is_blank(post_contact) and
    contains(atbb, '公開中')
)
cond_b = (equals(post_contact, '未') and contains(atbb, '公開中'))

if cond_a or cond_b:
    print(f"→ Priority 8: 一般媒介_内覧後売主連絡未 ← ここで止まっている可能性")
    print(f"  cond_a={cond_a}, cond_b={cond_b}")

# Priority 6: 当日TEL（担当なし）
if is_not_blank(ncd) and is_today_or_past(ncd) and is_blank(follow_up):
    print(f"→ Priority 6: 当日TEL（担当なし）に該当するはず")
else:
    print(f"Priority 6 当日TEL（担当なし）: 非該当")
    print(f"  next_call_date非空: {is_not_blank(ncd)}")
    print(f"  今日以前: {is_today_or_past(ncd) if ncd else False}")
    print(f"  follow_up_assignee空欄: {is_blank(follow_up)}")

# Priority 5: 問合メール未対応
inq_phone = b.get('inquiry_email_phone')
inq_reply = b.get('inquiry_email_reply')
if (equals(inq_phone, '未') or equals(inq_reply, '未') or
    (is_blank(latest_viewing) and equals(inq_phone, '不要') and (equals(inq_reply, '未') or is_blank(inq_reply)))):
    print(f"→ Priority 5: 問合メール未対応 ← ここで止まっている可能性")
    print(f"  inquiry_email_phone={inq_phone}, inquiry_email_reply={inq_reply}")

# Priority 7: 3回架電未
if equals(b.get('three_calls_confirmed'), '3回架電未') and (equals(inq_phone, '不通') or equals(inq_phone, '未')):
    print(f"→ Priority 7: 3回架電未 ← ここで止まっている可能性")

# 担当者ありの場合
if is_not_blank(follow_up):
    print(f"\n担当者あり（{follow_up}）の場合:")
    if is_not_blank(ncd) and is_today_or_past(ncd):
        print(f"→ 当日TEL({follow_up}) に該当するはず")
    else:
        print(f"→ 当日TEL({follow_up}) 非該当")
        print(f"  next_call_date: {ncd}")
        print(f"  今日以前: {is_today_or_past(ncd) if ncd else False}")

print(f"\n=== calculated_status（DB保存値）: '{b.get('calculated_status')}' ===")
