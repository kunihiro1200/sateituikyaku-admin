#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主7609の物件テーブルatbb_statusを確認するスクリプト
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# 買主7609のproperty_numberを確認
b_res = supabase.table('buyers').select('buyer_number, property_number, post_viewing_seller_contact, latest_viewing_date, viewing_type_general').eq('buyer_number', '7609').execute()
b = b_res.data[0]
print(f"買主7609:")
print(f"  property_number: '{b.get('property_number')}'")
print(f"  post_viewing_seller_contact: '{b.get('post_viewing_seller_contact')}'")
print(f"  latest_viewing_date: '{b.get('latest_viewing_date')}'")
print(f"  viewing_type_general: '{b.get('viewing_type_general')}'")
print()

prop_num = b.get('property_number')
if not prop_num:
    print("❌ property_numberが空です")
    exit()

# property_listingsテーブルからatbb_statusを確認
p_res = supabase.table('property_listings').select('property_number, atbb_status, sidebar_status, property_type').eq('property_number', prop_num).execute()
if p_res.data:
    p = p_res.data[0]
    print(f"物件 {prop_num}:")
    print(f"  atbb_status: '{p.get('atbb_status')}'")
    print(f"  sidebar_status: '{p.get('sidebar_status')}'")
    print(f"  property_type: '{p.get('property_type')}'")
else:
    print(f"❌ property_listings に {prop_num} が存在しません")
