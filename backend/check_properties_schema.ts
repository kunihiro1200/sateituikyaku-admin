import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  // AA13807のseller_id
  const sellerId = 'a5f435e1-7fa8-49ce-b0d6-3f2aa2390c65';

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('seller_id', sellerId)
    .limit(1);

  if (error) {
    console.error('エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('propertiesテーブルにAA13807のレコードなし');
    return;
  }

  console.log('カラム一覧:', Object.keys(data[0]));
  console.log('\nデータ:');
  for (const [key, val] of Object.entries(data[0])) {
    console.log(`  ${key}: ${JSON.stringify(val)}`);
  }
}

main().catch(console.error);
