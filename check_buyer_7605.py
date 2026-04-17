#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主7605のDB状態とスプレッドシートの同期状況を調査するスクリプト
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("=== 買主7605のDB状態確認 ===\n")

# 1. buyer_number = '7605' で検索
response = supabase.table('buyers').select('*').eq('buyer_number', '7605').execute()
buyers = response.data

if buyers:
    b = buyers[0]
    print(f"✅ 買主7605はDBに存在します")
    print(f"  id: {b.get('id')}")
    print(f"  buyer_number: {b.get('buyer_number')}")
    print(f"  name: {b.get('name')}")
    print(f"  reception_date: {b.get('reception_date')}")
    print(f"  created_at: {b.get('created_at')}")
    print(f"  updated_at: {b.get('updated_at')}")
    print(f"  last_synced_at: {b.get('last_synced_at')}")
    print(f"  synced_at: {b.get('synced_at')}")
    print(f"  db_updated_at: {b.get('db_updated_at')}")
    print(f"  is_deleted: {b.get('is_deleted')}")
    print(f"  deleted_at: {b.get('deleted_at')}")
else:
    print(f"❌ 買主7605はDBに存在しません")

print("\n=== 近隣の買主番号の存在確認 ===\n")

# 近隣の買主番号を確認
for num in ['7600', '7601', '7602', '7603', '7604', '7605', '7606', '7607', '7608', '7609', '7610']:
    r = supabase.table('buyers').select('buyer_number, name, reception_date, last_synced_at').eq('buyer_number', num).execute()
    if r.data:
        b = r.data[0]
        print(f"  {num}: ✅ 存在 - {b.get('name', 'N/A')} (受付日: {b.get('reception_date', 'N/A')}, 最終同期: {b.get('last_synced_at', 'N/A')})")
    else:
        print(f"  {num}: ❌ 不在")

print("\n=== 最近の同期ログ確認 ===\n")

# sync_logsテーブルが存在する場合
try:
    sync_logs = supabase.table('sync_logs').select('*').order('created_at', desc=True).limit(5).execute()
    if sync_logs.data:
        for log in sync_logs.data:
            print(f"  {log.get('created_at')}: {log.get('status')} - created:{log.get('created_count')}, updated:{log.get('updated_count')}, failed:{log.get('failed_count')}")
    else:
        print("  同期ログなし")
except Exception as e:
    print(f"  sync_logsテーブルアクセスエラー: {e}")

print("\n=== buyersテーブルの最大buyer_number確認 ===\n")

# 最大の買主番号を確認
try:
    # buyer_numberが数値として最大のものを確認
    all_buyers = supabase.table('buyers').select('buyer_number').execute()
    if all_buyers.data:
        numbers = []
        for b in all_buyers.data:
            try:
                numbers.append(int(b['buyer_number']))
            except (ValueError, TypeError):
                pass
        if numbers:
            numbers.sort()
            print(f"  最小buyer_number: {min(numbers)}")
            print(f"  最大buyer_number: {max(numbers)}")
            print(f"  総件数: {len(numbers)}")
            # 7600-7610の範囲を確認
            range_nums = [n for n in numbers if 7600 <= n <= 7610]
            print(f"  7600-7610の範囲: {range_nums}")
except Exception as e:
    print(f"  エラー: {e}")
