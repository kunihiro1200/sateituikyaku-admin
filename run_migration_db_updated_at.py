import urllib.request
import json

# .env.local から環境変数を読み込む
env = {}
with open('backend/.env.local', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

supabase_url = env.get('SUPABASE_URL', '').rstrip('/')
service_key = env.get('SUPABASE_SERVICE_KEY', '')

print(f'Supabase URL: {supabase_url[:40]}...')

# buyers テーブルに db_updated_at カラムが存在するか確認
# information_schema を直接クエリ
check_url = supabase_url + '/rest/v1/information_schema.columns?table_name=eq.buyers&column_name=eq.db_updated_at&select=column_name,data_type'

headers = {
    'apikey': service_key,
    'Authorization': f'Bearer {service_key}',
}

try:
    req = urllib.request.Request(check_url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as r:
        result = json.loads(r.read())
        if result:
            print('✅ db_updated_at カラムは既に存在します:', result)
        else:
            print('❌ db_updated_at カラムが存在しません')
            print('\n以下のSQLをSupabase SQL Editorで実行してください:')
            print('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;')
            print(f'\nSQL Editor: https://supabase.com/dashboard/project/krxhrbtlgfjzsseegaqq/sql/new')
except Exception as e:
    print(f'確認失敗: {e}')
    print('\n以下のSQLをSupabase SQL Editorで実行してください:')
    print('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;')
    print(f'\nSQL Editor: https://supabase.com/dashboard/project/krxhrbtlgfjzsseegaqq/sql/new')
