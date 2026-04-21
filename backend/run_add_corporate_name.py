import psycopg2

# Session Pooler経由で接続（ポート5432）
conn_str = 'postgresql://postgres.krxhrbtlgfjzsseegaqq:CIWxQGSf74lks01H@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'

try:
    conn = psycopg2.connect(conn_str, sslmode='require', connect_timeout=15)
    print('接続成功!')
    cur = conn.cursor()

    # corporate_nameカラムを追加
    cur.execute('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS corporate_name TEXT;')
    conn.commit()
    print('✅ corporate_name カラムを追加しました')

    # 確認
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'buyers' AND column_name = 'corporate_name';
    """)
    rows = cur.fetchall()
    print('確認結果:', rows)

    cur.close()
    conn.close()
except Exception as e:
    print(f'エラー: {e}')
