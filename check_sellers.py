#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AA13224とAA13932のデータを確認するスクリプト
"""

import os
from supabase import create_client, Client
from datetime import datetime

# Supabase接続
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 対象の売主番号
seller_numbers = ['AA13224', 'AA13932']

print("=" * 80)
print("AA13224とAA13932のデータ確認")
print("=" * 80)
print()

for seller_number in seller_numbers:
    print(f"\n{'=' * 80}")
    print(f"売主番号: {seller_number}")
    print(f"{'=' * 80}")
    
    # データ取得
    response = supabase.table('sellers').select('*').eq('seller_number', seller_number).execute()
    
    if not response.data:
        print(f"❌ {seller_number} が見つかりません")
        continue
    
    seller = response.data[0]
    
    # 重要なフィールドを表示
    print(f"\n【基本情報】")
    print(f"  seller_number: {seller.get('seller_number')}")
    print(f"  id: {seller.get('id')}")
    
    print(f"\n【当日TEL判定に関連するフィールド】")
    print(f"  situation_company (状況（当社）): {seller.get('situation_company')}")
    print(f"  next_call_date (次電日): {seller.get('next_call_date')}")
    print(f"  visit_assignee (営担): {seller.get('visit_assignee')}")
    
    print(f"\n【コミュニケーション情報】")
    print(f"  contact_method (連絡方法): {seller.get('contact_method')}")
    print(f"  preferred_contact_time (連絡取りやすい時間): {seller.get('preferred_contact_time')}")
    print(f"  phone_contact_person (電話担当): {seller.get('phone_contact_person')}")
    
    print(f"\n【その他の関連フィールド】")
    print(f"  unreachable_status (不通): {seller.get('unreachable_status')}")
    print(f"  response_date (反響日付): {seller.get('response_date')}")
    
    # 判定ロジックのシミュレーション
    print(f"\n【判定ロジックのシミュレーション】")
    
    # 1. 状況（当社）に「追客」が含まれるか
    situation_company = seller.get('situation_company') or ''
    has_tsuikaku = '追客' in situation_company if isinstance(situation_company, str) else False
    print(f"  1. 状況（当社）に「追客」が含まれる: {has_tsuikaku}")
    if has_tsuikaku:
        print(f"     → 値: '{situation_company}'")
    
    # 2. 除外条件（追客不要、専任媒介、一般媒介）
    excluded = False
    if isinstance(situation_company, str):
        if '追客不要' in situation_company:
            excluded = True
            print(f"  2. 除外条件: 「追客不要」が含まれる → 除外")
        elif '専任媒介' in situation_company:
            excluded = True
            print(f"  2. 除外条件: 「専任媒介」が含まれる → 除外")
        elif '一般媒介' in situation_company:
            excluded = True
            print(f"  2. 除外条件: 「一般媒介」が含まれる → 除外")
        else:
            print(f"  2. 除外条件: なし → OK")
    
    # 3. 次電日が今日以前か
    next_call_date = seller.get('next_call_date')
    today = datetime.now().date()
    is_today_or_before = False
    if next_call_date:
        try:
            next_date = datetime.fromisoformat(str(next_call_date).replace('Z', '+00:00')).date()
            is_today_or_before = next_date <= today
            print(f"  3. 次電日が今日以前: {is_today_or_before}")
            print(f"     → 次電日: {next_date}, 今日: {today}")
        except:
            print(f"  3. 次電日が今日以前: False（日付パースエラー）")
            print(f"     → 次電日: {next_call_date}")
    else:
        print(f"  3. 次電日が今日以前: False（次電日が空）")
    
    # 4. 営担が空か
    visit_assignee = seller.get('visit_assignee')
    has_visit_assignee = visit_assignee and str(visit_assignee).strip() != ''
    print(f"  4. 営担が空: {not has_visit_assignee}")
    if has_visit_assignee:
        print(f"     → 営担: '{visit_assignee}'")
    
    # 5. コミュニケーション情報が全て空か
    contact_method = seller.get('contact_method')
    preferred_contact_time = seller.get('preferred_contact_time')
    phone_contact_person = seller.get('phone_contact_person')
    
    has_contact_info = (
        (contact_method and str(contact_method).strip() != '') or
        (preferred_contact_time and str(preferred_contact_time).strip() != '') or
        (phone_contact_person and str(phone_contact_person).strip() != '')
    )
    print(f"  5. コミュニケーション情報が全て空: {not has_contact_info}")
    
    # 最終判定
    print(f"\n【最終判定】")
    should_be_in_today_call = (
        has_tsuikaku and
        not excluded and
        is_today_or_before and
        not has_visit_assignee and
        not has_contact_info
    )
    print(f"  「当日TEL」カテゴリに表示されるべき: {should_be_in_today_call}")
    
    if not should_be_in_today_call:
        print(f"\n  ❌ 表示されない理由:")
        if not has_tsuikaku:
            print(f"     - 状況（当社）に「追客」が含まれていない")
        if excluded:
            print(f"     - 除外条件に該当（追客不要/専任媒介/一般媒介）")
        if not is_today_or_before:
            print(f"     - 次電日が今日より後、または空")
        if has_visit_assignee:
            print(f"     - 営担に値が入っている")
        if has_contact_info:
            print(f"     - コミュニケーション情報に値が入っている")

print(f"\n{'=' * 80}")
print("確認完了")
print(f"{'=' * 80}")
