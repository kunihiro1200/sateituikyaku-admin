import os
from supabase import create_client
from dotenv import load_dotenv

# .env.productionファイルを読み込む
load_dotenv('.env.production')

url = os.getenv('SUPABASE_URL', '').strip('"')
key = os.getenv('SUPABASE_SERVICE_KEY', '').strip('"')

print(f'URL: {url}')
print(f'Key exists: {key is not None}')

supabase = create_client(url, key)

# visitDayBeforeカテゴリーのレコードを確認
response = supabase.table('seller_sidebar_counts').select('*').eq('category', 'visitDayBefore').execute()

print('\n=== visitDayBeforeカテゴリーのレコード ===')
print(f'レコード数: {len(response.data)}')
for record in response.data:
    print(f'ID: {record.get("id")}, label: {record.get("label")}, count: {record.get("count")}, seller_ids: {record.get("seller_ids", [])}')

# labelが空でないレコードを確認
non_empty_label = [r for r in response.data if r.get('label') and r.get('label').strip() != '']
print(f'\nlabelが空でないレコード数: {len(non_empty_label)}')
for record in non_empty_label:
    print(f'ID: {record.get("id")}, label: "{record.get("label")}"')

# 重複レコードを確認
print(f'\n重複レコード: {len(response.data) > 1}')
if len(response.data) > 1:
    print('複数のvisitDayBeforeレコードが存在します')
