import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { error } = await supabase
    .from('sellers')
    .update({ inquiry_date: '2026-03-09' })
    .eq('seller_number', 'AA13761');

  if (error) {
    console.error('エラー:', error.message);
    return;
  }

  console.log('✅ AA13761の反響日付を 2026-03-09 に設定しました');

  // 確認
  const { data } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date')
    .eq('seller_number', 'AA13761')
    .single();
  console.log('確認:', data);
}

main();
