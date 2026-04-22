#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APIを叩いて7609のcalculated_statusを確認するスクリプト
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv('backend/.env')

# バックエンドAPIのURL（ローカル）
BASE_URL = "http://localhost:3000"

# 7609を検索
try:
    resp = requests.get(f"{BASE_URL}/api/buyers?search=7609&limit=5", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        buyers = data.get('data', [])
        for b in buyers:
            if b.get('buyer_number') == '7609':
                print(f"=== 7609のAPIレスポンス ===")
                print(f"  buyer_number: {b.get('buyer_number')}")
                print(f"  calculated_status: {b.get('calculated_status')}")
                print(f"  status_priority: {b.get('status_priority')}")
                print(f"  atbb_status: {b.get('atbb_status')}")
                print(f"  post_viewing_seller_contact: {b.get('post_viewing_seller_contact')}")
                print(f"  viewing_type_general: {b.get('viewing_type_general')}")
                print(f"  latest_viewing_date: {b.get('latest_viewing_date')}")
                print(f"  viewing_date: {b.get('viewing_date')}")
                print(f"  follow_up_assignee: {b.get('follow_up_assignee')}")
                break
        else:
            print("7609が見つかりませんでした")
            print(f"取得件数: {len(buyers)}")
            for b in buyers:
                print(f"  {b.get('buyer_number')}: {b.get('calculated_status')}")
    else:
        print(f"APIエラー: {resp.status_code}")
        print(resp.text[:500])
except Exception as e:
    print(f"接続エラー: {e}")
    print("ローカルサーバーが起動していない可能性があります")
    print()
    print("代わりにSupabaseから直接確認します...")
    
    from supabase import create_client, Client
    load_dotenv('backend/.env')
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase: Client = create_client(url, key)
    
    # fetchAllBuyersWithStatusと同じ処理をシミュレート
    # fetchBuyersForSidebarCountsが返すデータを確認
    SIDEBAR_COLUMNS = 'buyer_number,reception_date,latest_viewing_date,viewing_date,next_call_date,follow_up_assignee,initial_assignee,latest_status,inquiry_confidence,inquiry_email_phone,inquiry_email_reply,three_calls_confirmed,broker_inquiry,inquiry_source,viewing_result_follow_up,viewing_unconfirmed,viewing_type_general,post_viewing_seller_contact,notification_sender,valuation_survey,valuation_survey_confirmed,broker_survey,vendor_survey,day_of_week,pinrich,email,pinrich_500man_registration,email_confirmed,email_confirmation_assignee,viewing_promotion_not_needed,viewing_promotion_sender,past_buyer_list,property_number'
    
    res = supabase.table('buyers').select(SIDEBAR_COLUMNS).eq('buyer_number', '7609').execute()
    b = res.data[0]
    
    # property_listingsからatbb_statusを取得
    prop_num = b.get('property_number')
    p_res = supabase.table('property_listings').select('property_number, atbb_status').eq('property_number', prop_num).execute()
    atbb = p_res.data[0].get('atbb_status') if p_res.data else None
    
    print(f"fetchBuyersForSidebarCounts後の7609データ:")
    print(f"  atbb_status (結合後): '{atbb}'")
    print(f"  post_viewing_seller_contact: '{b.get('post_viewing_seller_contact')}'")
    print(f"  viewing_date: '{b.get('viewing_date')}'")
    print(f"  follow_up_assignee: '{b.get('follow_up_assignee')}'")
    print()
    
    # 条件B確認
    cond_b = b.get('post_viewing_seller_contact') == '未' and atbb and '公開中' in atbb
    print(f"条件B成立: {cond_b}")
    print()
    print("→ Priority 8が成立するはずなのに、buyer_sidebar_countsが0の理由を調査中...")
    print()
    
    # buyer_sidebar_countsの更新日時と7609の同期日時を比較
    counts_res = supabase.table('buyer_sidebar_counts').select('category,count,updated_at').eq('category', 'generalViewingSellerContactPending').execute()
    if counts_res.data:
        row = counts_res.data[0]
        print(f"buyer_sidebar_counts.generalViewingSellerContactPending:")
        print(f"  count: {row.get('count')}")
        print(f"  updated_at: {row.get('updated_at')}")
    
    print()
    print(f"7609のpost_viewing_seller_contactがスプレッドシートで'未'になったのはいつ？")
    print(f"  buyers.db_updated_at: {supabase.table('buyers').select('db_updated_at').eq('buyer_number', '7609').execute().data[0].get('db_updated_at')}")
    print(f"  buyers.last_synced_at: {supabase.table('buyers').select('last_synced_at').eq('buyer_number', '7609').execute().data[0].get('last_synced_at')}")
