#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerServiceのdecryptSellerメソッドがstatusフィールドを返すか確認
"""

from supabase import create_client, Client

# Supabase接続
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("SellerService decryptSeller メソッドの確認")
print("=" * 80)
print()

# AA13224とAA13932を取得
seller_numbers = ['AA13224', 'AA13932']

for seller_number in seller_numbers:
    print(f"\n{'=' * 80}")
    print(f"売主番号: {seller_number}")
    print(f"{'=' * 80}")
    
    # データベースから取得
    response = supabase.table('sellers').select('*').eq('seller_number', seller_number).execute()
    
    if not response.data:
        print(f"❌ {seller_number} が見つかりません")
        continue
    
    seller = response.data[0]
    
    print(f"\n【データベースの生データ】")
    print(f"  status: {seller.get('status')}")
    print(f"  next_call_date: {seller.get('next_call_date')}")
    print(f"  visit_assignee: {seller.get('visit_assignee')}")
    print(f"  contact_method: {seller.get('contact_method')}")
    print(f"  preferred_contact_time: {seller.get('preferred_contact_time')}")
    print(f"  phone_contact_person: {seller.get('phone_contact_person')}")
    
    print(f"\n【SellerServiceが返すべきフィールド名（camelCase）】")
    print(f"  status: {seller.get('status')}")
    print(f"  nextCallDate: {seller.get('next_call_date')}")
    print(f"  visitAssignee: {seller.get('visit_assignee')}")
    print(f"  contactMethod: {seller.get('contact_method')}")
    print(f"  preferredContactTime: {seller.get('preferred_contact_time')}")
    print(f"  phoneContactPerson: {seller.get('phone_contact_person')}")
    
    print(f"\n【判定】")
    status = seller.get('status') or ''
    has_tsuikaku = '追客' in status if isinstance(status, str) else False
    
    if has_tsuikaku:
        print(f"  ✅ 状況（当社）に「追客」が含まれる: '{status}'")
    else:
        print(f"  ❌ 状況（当社）に「追客」が含まれない: '{status}'")

print(f"\n{'=' * 80}")
print("確認完了")
print(f"{'=' * 80}")
print()
print("【重要】")
print("SellerService.supabase.tsのdecryptSellerメソッドで、")
print("statusフィールドがレスポンスに含まれているか確認してください。")
