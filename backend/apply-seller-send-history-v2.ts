import * as https from 'https';

// Supabase接続情報
const SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// Supabase REST APIでSQLを実行する関数
function execSQL(sql: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || '{}'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Supabase Management APIでSQLを実行する関数
function execSQLViaManagementAPI(sql: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const projectRef = 'krxhrbtlgfjzsseegaqq';
    const body = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🚀 売主送信履歴マイグレーション開始');
  console.log('');

  const statements = [
    {
      name: 'subject カラム追加',
      sql: `ALTER TABLE property_chat_history ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT ''`,
    },
    {
      name: 'chat_type CHECK制約を削除',
      sql: `ALTER TABLE property_chat_history DROP CONSTRAINT IF EXISTS property_chat_history_chat_type_check`,
    },
    {
      name: 'chat_type CHECK制約を再作成（seller_email/seller_sms/seller_gmail追加）',
      sql: `ALTER TABLE property_chat_history ADD CONSTRAINT property_chat_history_chat_type_check CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'))`,
    },
    {
      name: 'chat_type インデックス作成',
      sql: `CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type ON property_chat_history(chat_type)`,
    },
  ];

  for (const stmt of statements) {
    console.log(`⏳ ${stmt.name}...`);
    try {
      await execSQLViaManagementAPI(stmt.sql);
      console.log(`  ✅ 完了`);
    } catch (err: any) {
      console.error(`  ❌ エラー: ${err.message}`);
      throw err;
    }
  }

  console.log('');
  console.log('✅ マイグレーション完了！');
  console.log('');
  console.log('適用内容:');
  console.log('  - property_chat_history.subject カラム追加（TEXT DEFAULT \'\'）');
  console.log('  - chat_type CHECK制約更新（seller_email, seller_sms, seller_gmail を追加）');
  console.log('  - chat_type インデックス作成');
}

main().catch(e => {
  console.error('❌ マイグレーション失敗:', e.message);
  process.exit(1);
});
