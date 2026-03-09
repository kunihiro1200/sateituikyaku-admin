import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // AA13760のデータを確認
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date, created_at, deleted_at, status')
    .eq('seller_number', 'AA13760')
    .single();

  console.log('AA13760:', seller, 'error:', error);

  // inquiry_dateの降順で上位10件を確認
  const { data: top10 } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date, created_at, deleted_at')
    .is('deleted_at', null)
    .order('inquiry_date', { ascending: false, nullsFirst: false })
    .limit(10);

  console.log('\n反響日付降順 上位10件（削除済み除外）:');
  top10?.forEach(s => console.log(`  ${s.seller_number}: inquiry_date=${s.inquiry_date}`));

  // AA13760が削除済みかどうか確認（deleted_at含む）
  const { data: all } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date, deleted_at')
    .in('seller_number', ['AA13758', 'AA13759', 'AA13760', 'AA13761', 'AA13762']);

  console.log('\nAA13758-13762の状態:');
  all?.forEach(s => console.log(`  ${s.seller_number}: inquiry_date=${s.inquiry_date}, deleted_at=${s.deleted_at}`));
}

main();
