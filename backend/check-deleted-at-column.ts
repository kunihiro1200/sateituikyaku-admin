import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .select('id, deleted_at')
    .limit(1);

  if (error) {
    console.log('ERROR:', error.message);
    console.log('→ deleted_at カラムが存在しない可能性があります');
    console.log('→ 以下のSQLをSupabase管理画面で実行してください:');
    console.log('ALTER TABLE buyers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;');
  } else {
    console.log('OK: deleted_at カラムが存在します');
    console.log('サンプル:', JSON.stringify(data));
  }
  process.exit(0);
}

main().catch(console.error);
