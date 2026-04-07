#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
売主リストAPIのレスポンスを確認するスクリプト
"""

import requests
import json

# API URL
API_URL = "https://baikyaku-property-site3.vercel.app/api/sellers"

print("=" * 80)
print("売主リストAPI レスポンス確認")
print("=" * 80)
print()

# 認証トークン（必要な場合）
# headers = {"Authorization": "Bearer YOUR_TOKEN"}

# 売主リストを取得
print("APIリクエスト中...")
response = requests.get(API_URL, params={"page": 1, "pageSize": 1000})

if response.status_code != 200:
    print(f"❌ APIエラー: {response.status_code}")
    print(response.text)
    exit(1)

data = response.json()
sellers = data.get('sellers', [])

print(f"取得した売主数: {len(sellers)}")
print()

# AA13224とAA13932を検索
target_numbers = ['AA13224', 'AA13932']

for seller_number in target_numbers:
    print(f"\n{'=' * 80}")
    print(f"売主番号: {seller_number}")
    print(f"{'=' * 80}")
    
    # 売主を検索
    seller = next((s for s in sellers if s.get('sellerNumber') == seller_number), None)
    
    if not seller:
        print(f"❌ {seller_number} がAPIレスポンスに含まれていません")
        continue
    
    print(f"\n【基本情報】")
    print(f"  sellerNumber: {seller.get('sellerNumber')}")
    print(f"  id: {seller.get('id')}")
    
    print(f"\n【当日TEL判定に関連するフィールド】")
    print(f"  status (状況（当社）): {seller.get('status')}")
    print(f"  nextCallDate (次電日): {seller.get('nextCallDate')}")
    print(f"  visitAssignee (営担): {seller.get('visitAssignee')}")
    
    print(f"\n【コミュニケーション情報】")
    print(f"  contactMethod (連絡方法): {seller.get('contactMethod')}")
    print(f"  preferredContactTime (連絡取りやすい時間): {seller.get('preferredContactTime')}")
    print(f"  phoneContactPerson (電話担当): {seller.get('phoneContactPerson')}")
    
    print(f"\n【その他の関連フィールド】")
    print(f"  unreachableStatus (不通): {seller.get('unreachableStatus')}")
    
    # 判定ロジックのシミュレーション
    print(f"\n【判定ロジックのシミュレーション】")
    
    # 1. 状況（当社）に「追客」が含まれるか
    status = seller.get('status') or ''
    has_tsuikaku = '追客' in status if isinstance(status, str) else False
    print(f"  1. 状況（当社）に「追客」が含まれる: {has_tsuikaku}")
    if has_tsuikaku:
        print(f"     → 値: '{status}'")
    else:
        print(f"     → 値: '{status}' （「追客」が含まれていない）")
    
    # 2. 除外条件
    excluded = False
    if isinstance(status, str):
        if '追客不要' in status:
            excluded = True
            print(f"  2. 除外条件: 「追客不要」が含まれる → 除外")
        elif '専任媒介' in status:
            excluded = True
            print(f"  2. 除外条件: 「専任媒介」が含まれる → 除外")
        elif '一般媒介' in status:
            excluded = True
            print(f"  2. 除外条件: 「一般媒介」が含まれる → 除外")
        else:
            print(f"  2. 除外条件: なし → OK")
    
    # 3. 次電日が今日以前か
    next_call_date = seller.get('nextCallDate')
    print(f"  3. 次電日: {next_call_date}")
    
    # 4. 営担が空か
    visit_assignee = seller.get('visitAssignee')
    has_visit_assignee = visit_assignee and str(visit_assignee).strip() != ''
    print(f"  4. 営担が空: {not has_visit_assignee}")
    if has_visit_assignee:
        print(f"     → 営担: '{visit_assignee}'")
    
    # 5. コミュニケーション情報が全て空か
    contact_method = seller.get('contactMethod')
    preferred_contact_time = seller.get('preferredContactTime')
    phone_contact_person = seller.get('phoneContactPerson')
    
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
        if has_visit_assignee:
            print(f"     - 営担に値が入っている")
        if has_contact_info:
            print(f"     - コミュニケーション情報に値が入っている")

print(f"\n{'=' * 80}")
print("確認完了")
print(f"{'=' * 80}")
