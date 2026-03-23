import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('Migration 103: activity_logs.target_id を UUID → TEXT に変更');

  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE activity_logs ALTER COLUMN target_id TYPE TEXT;'
  });

  if (error) {
    // exec_sql RPCがない場合は直接試みる
    console.error('RPC失敗、直接実行を試みます:', error.message);
    
    // Supabase REST APIでは直接DDLを実行できないため、手動実行が必要
    console.log('\n以下のSQLをSupabaseのSQL Editorで実行してください:');
    console.log('ALTER TABLE activity_logs ALTER COLUMN target_id TYPE TEXT;');
    process.exit(1);
  }

  console.log('✅ マイグレーション完了');
}

run().catch(console.error);
