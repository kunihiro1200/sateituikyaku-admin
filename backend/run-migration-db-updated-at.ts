import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function runMigration() {
  console.log('buyers テーブルに db_updated_at カラムを追加中...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;'
  });

  if (error) {
    // rpc が使えない場合は直接 REST API で実行
    console.log('rpc 失敗、別の方法を試みます:', error.message);

    // Supabase の管理 API を使用
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
        },
        body: JSON.stringify({
          sql: 'ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;'
        })
      }
    );
    
    if (!response.ok) {
      const text = await response.text();
      console.error('マイグレーション失敗:', text);
      console.log('\n手動でSupabase SQL Editorで以下を実行してください:');
      console.log('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;');
      return;
    }
  }

  // カラムが追加されたか確認
  const { data, error: checkError } = await supabase
    .from('buyers')
    .select('db_updated_at')
    .limit(1);

  if (checkError) {
    console.error('確認エラー:', checkError.message);
    console.log('\n手動でSupabase SQL Editorで以下を実行してください:');
    console.log('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;');
  } else {
    console.log('✅ db_updated_at カラムが正常に追加されました');
  }
}

runMigration().catch(console.error);
