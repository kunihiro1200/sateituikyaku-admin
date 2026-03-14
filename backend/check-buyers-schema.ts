import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // buyer_numberで検索してカラム一覧を確認
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .limit(1);

  if (error) {
    console.log('ERROR:', error.message);
  } else if (data && data.length > 0) {
    console.log('カラム一覧:', Object.keys(data[0]).join(', '));
    console.log('deleted_at あり:', 'deleted_at' in data[0]);
    console.log('id あり:', 'id' in data[0]);
    console.log('buyer_id あり:', 'buyer_id' in data[0]);
  } else {
    console.log('データなし（テーブルは存在する）');
  }
  process.exit(0);
}

main().catch(console.error);
