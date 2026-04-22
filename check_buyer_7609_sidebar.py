#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主7609のサイドバー未表示問題を調査するスクリプト
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("=== 買主7609のDB状態確認 ===\n")

response = supabase.table('buyers').select('*').eq('buyer_number', '7609').execute()
buyers = response.data

if not buyers:
    print("❌ 買主7609はDBに存在しません")
    exit()

b = buyers[0]
print(f"✅ 買主7609はDBに存在します")
print()

# Priority 8判定に関係するフィールド
print("=== Priority 8 (一般媒介_内覧後売主連絡未) 関連フィールド ===")
print(f"  viewing_type_general (内覧形態_一般媒介): '{b.get('viewing_type_general')}'")
print(f"  latest_viewing_date (内覧日): '{b.get('latest_viewing_date')}'")
print(f"  post_viewing_seller_contact (内覧後売主連絡): '{b.get('post_viewing_seller_contact')}'")
print(f"  atbb_status (物件公開ステータス): '{b.get('atbb_status')}'")
print()

# Priority 1〜7, 9〜15に関係するフィールド（先に該当する可能性）
print("=== Priority 1〜7, 9〜15 関連フィールド（先に該当する可能性） ===")
print(f"  valuation_survey (査定アンケート): '{b.get('valuation_survey')}'")
print(f"  valuation_survey_confirmed (査定アンケート確認済み): '{b.get('valuation_survey_confirmed')}'")
print(f"  vendor_survey (業者アンケート): '{b.get('vendor_survey')}'")
print(f"  viewing_date (内覧予定日): '{b.get('viewing_date')}'")
print(f"  notification_sender (通知送信者): '{b.get('notification_sender')}'")
print(f"  broker_inquiry (業者問合せ): '{b.get('broker_inquiry')}'")
print(f"  viewing_unconfirmed (内覧未確定): '{b.get('viewing_unconfirmed')}'")
print(f"  inquiry_email_phone (電話対応): '{b.get('inquiry_email_phone')}'")
print(f"  inquiry_email_reply (メール返信): '{b.get('inquiry_email_reply')}'")
print(f"  three_calls_confirmed (3回架電確認済み): '{b.get('three_calls_confirmed')}'")
print(f"  follow_up_assignee (追客担当): '{b.get('follow_up_assignee')}'")
print(f"  viewing_result_follow_up (内覧後フォローアップ): '{b.get('viewing_result_follow_up')}'")
print()

# 全フィールド
print("=== 全フィールド ===")
for k, v in sorted(b.items()):
    if v is not None and v != '':
        print(f"  {k}: '{v}'")
