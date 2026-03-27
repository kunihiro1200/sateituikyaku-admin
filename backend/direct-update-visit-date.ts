/**
 * AA13863のvisit_dateを直接DBに書き込むテスト
 */
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  console.log('直接updateを実行...');
  const { error } = await supabase
    .from('sellers')
    .update({ visit_date: '2026-03-29' })
    .eq('seller_number', 'AA13863');

  if (error) {
    console.error('エラー:', error);
  } else {
    console.log('成功');
  }

  // 確認
  const { data } = await supabase
    .from('sellers')
    .select('seller_number, visit_date')
    .eq('seller_number', 'AA13863')
    .single();
  console.log('DB確認:', data);
}

main().catch(console.error);
