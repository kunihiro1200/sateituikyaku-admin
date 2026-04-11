import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function execSQL(sql: string, name: string) {
  console.log(`⏳ ${name}...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // exec_sql RPCが存在しない場合は別の方法を試す
    throw new Error(`RPC error: ${error.message}`);
  }
  console.log(`  ✅ 完了`);
  return data;
}

async function main() {
  console.log('🚀 売主送信履歴マイグレーション開始');
  console.log('');

  // まずRPCが使えるか確認
  try {
    await execSQL(`SELECT 1`, 'RPC接続テスト');
  } catch (err: any) {
    console.log('  ℹ️ exec_sql RPCが使えません。別の方法を試します...');
    console.log('');
    
    // Supabase REST APIのPOST /sql エンドポイントを試す
    await runViaSQLEndpoint();
    return;
  }

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
      name: 'chat_type CHECK制約を再作成',
      sql: `ALTER TABLE property_chat_history ADD CONSTRAINT property_chat_history_chat_type_check CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'))`,
    },
    {
      name: 'chat_type インデックス作成',
      sql: `CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type ON property_chat_history(chat_type)`,
    },
  ];

  for (const stmt of statements) {
    await execSQL(stmt.sql, stmt.name);
  }

  console.log('');
  console.log('✅ マイグレーション完了！');
}

async function runViaSQLEndpoint() {
  const https = require('https');
  
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
      name: 'chat_type CHECK制約を再作成',
      sql: `ALTER TABLE property_chat_history ADD CONSTRAINT property_chat_history_chat_type_check CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'))`,
    },
    {
      name: 'chat_type インデックス作成',
      sql: `CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type ON property_chat_history(chat_type)`,
    },
  ];

  for (const stmt of statements) {
    console.log(`⏳ ${stmt.name}...`);
    
    await new Promise<void>((resolve, reject) => {
      const body = JSON.stringify({ query: stmt.sql });
      const options = {
        hostname: 'krxhrbtlgfjzsseegaqq.supabase.co',
        path: '/rest/v1/sql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`  ✅ 完了`);
            resolve();
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

  console.log('');
  console.log('✅ マイグレーション完了！');
}

main().catch(e => {
  console.error('❌ マイグレーション失敗:', e.message);
  process.exit(1);
});
