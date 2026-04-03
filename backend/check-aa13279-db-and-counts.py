import os
import json
from supabase import create_client, Client
from datetime import datetime, timedelta

# Supabase接続
url = "https://krxhrbtlgfjzsseegaqq.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
supabase: Client = create_client(url, key)

# AA13279のデータを取得
seller_response = supabase.table('sellers').select('seller_number, visit_assignee, visit_date, status, updated_at').eq('seller_number', 'AA13279').single().execute()
seller = seller_response.data

print('=== AA13279のDBデータ ===')
print(f'売主番号: {seller["seller_number"]}')
print(f'営担: {seller["visit_assignee"] or "（null）"}')
print(f'訪問日: {seller["visit_date"] or "（null）"}')
print(f'状況（当社）: {seller["status"]}')
print(f'更新日時: {seller["updated_at"]}')

# 今日の日付
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
print(f'\n今日: {today.strftime("%Y-%m-%d")} ({["月","火","水","木","金","土","日"][today.weekday()]}曜)')

# 訪問日を解析
if seller['visit_date']:
    visit_date = datetime.fromisoformat(seller['visit_date'].replace('Z', '+00:00'))
    visit_date = visit_date.replace(hour=0, minute=0, second=0, microsecond=0)
    visit_day = visit_date.weekday()  # 0=月曜, 3=木曜
    days_before = 2 if visit_day == 3 else 1  # 木曜訪問のみ2日前
    
    notify_date = visit_date - timedelta(days=days_before)
    
    print(f'訪問日: {visit_date.strftime("%Y-%m-%d")} ({["月","火","水","木","金","土","日"][visit_day]}曜)')
    print(f'通知日（前営業日）: {notify_date.strftime("%Y-%m-%d")}')
    print(f'今日 === 通知日: {today == notify_date}')
    print(f'\n営担が入力されている: {seller["visit_assignee"] is not None}')
    print(f'訪問日が入力されている: {seller["visit_date"] is not None}')
    print(f'訪問日前日の条件を満たす: {seller["visit_assignee"] is not None and today == notify_date}')

# seller_sidebar_countsを取得
counts_response = supabase.table('seller_sidebar_counts').select('*').order('updated_at', desc=True).limit(10).execute()
counts = counts_response.data

print('\n=== seller_sidebar_counts（最新10件） ===')
for row in counts:
    print(f'{row["category"]}: {row["count"]} (更新: {row["updated_at"]})')
