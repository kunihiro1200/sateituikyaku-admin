#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問日が空欄（null）の売主を確認するスクリプト
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv('backend/.env')

# Supabaseクライアントを作成
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("=" * 75)
print("訪問日が空欄（null）の売主を確認")
print("=" * 75)
print()

# 訪問日が空欄の売主を取得
response = supabase.table('sellers').select(
    'id, seller_number, visit_date, visit_assignee, visit_reminder_assignee'
).is_('deleted_at', None).is_('visit_date', None).execute()

sellers = response.data

print(f"【結果】訪問日が空欄（null）の売主: {len(sellers)}件")
print()

if len(sellers) > 0:
    print("【最初の10件を表示】")
    for i, seller in enumerate(sellers[:10], 1):
        print(f"{i}. {seller['seller_number']}")
        print(f"   訪問日: {seller['visit_date']}")
        print(f"   営担: {seller['visit_assignee']}")
        print(f"   訪問前日通知担当: {seller['visit_reminder_assignee']}")
        print()

print("=" * 75)
print("確認完了")
print("=" * 75)
