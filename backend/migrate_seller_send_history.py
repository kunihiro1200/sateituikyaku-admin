#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
売主送信履歴マイグレーション
Supabase REST API経由でSQLを実行する
"""

import urllib.request
import urllib.error
import json

SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co'
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'

def exec_sql_via_rest(sql, name):
    """Supabase REST API経由でSQLを実行する"""
    print(f"⏳ {name}...")
    
    body = json.dumps({'query': sql}).encode('utf-8')
    url = f'{SUPABASE_URL}/rest/v1/sql'
    
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json',
    })
    
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            print(f"  ✅ 完了: {data}")
            return data
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        raise Exception(f"HTTP {e.code}: {error_body}")


def check_column_exists():
    """subjectカラムが既に存在するか確認する"""
    url = f'{SUPABASE_URL}/rest/v1/property_chat_history?limit=1'
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
    })
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        if data:
            return 'subject' in data[0]
        return False


def main():
    print("🚀 売主送信履歴マイグレーション開始")
    print("")
    
    # 現在のカラム確認
    url = f'{SUPABASE_URL}/rest/v1/property_chat_history?limit=1'
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
    })
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        if data:
            print(f"現在のカラム: {list(data[0].keys())}")
        else:
            print("テーブルは空です")
    print("")
    
    # REST API SQLエンドポイントを試す
    try:
        exec_sql_via_rest("SELECT 1 as test", "接続テスト")
        print("REST API SQL エンドポイントが使えます")
        
        statements = [
            ("subject カラム追加", "ALTER TABLE property_chat_history ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT ''"),
            ("chat_type CHECK制約を削除", "ALTER TABLE property_chat_history DROP CONSTRAINT IF EXISTS property_chat_history_chat_type_check"),
            ("chat_type CHECK制約を再作成", "ALTER TABLE property_chat_history ADD CONSTRAINT property_chat_history_chat_type_check CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'))"),
            ("chat_type インデックス作成", "CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type ON property_chat_history(chat_type)"),
        ]
        
        for name, sql in statements:
            exec_sql_via_rest(sql, name)
        
        print("")
        print("✅ マイグレーション完了！")
        
    except Exception as e:
        print(f"REST API SQLエンドポイントが使えません: {e}")
        print("")
        print("=" * 60)
        print("⚠️  手動でSupabaseダッシュボードからSQLを実行してください")
        print("=" * 60)
        print("")
        print("URL: https://supabase.com/dashboard/project/krxhrbtlgfjzsseegaqq/sql")
        print("")
        print("以下のSQLを実行してください:")
        print("")
        print("""-- 1. subject カラムを追加
ALTER TABLE property_chat_history
  ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT '';

-- 2. 既存の chat_type CHECK 制約を削除して再作成
ALTER TABLE property_chat_history
  DROP CONSTRAINT IF EXISTS property_chat_history_chat_type_check;

ALTER TABLE property_chat_history
  ADD CONSTRAINT property_chat_history_chat_type_check
    CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'));

-- 3. chat_type カラムへのインデックスを追加
CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type
  ON property_chat_history(chat_type);""")


if __name__ == '__main__':
    main()
