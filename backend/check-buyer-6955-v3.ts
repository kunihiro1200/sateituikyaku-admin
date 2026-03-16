import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // deleted_at も含めて全カラムを確認
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, buyer_id, property_number, deleted_at, name')
    .eq('buyer_number', 6955)
    .single();

  if (error) {
    console.log('エラー:', error.message);
    return;
  }

  console.log('買主6955の全データ:');
  console.log('  buyer_number:', data?.buyer_number);
  console.log('  buyer_id:', data?.buyer_id);
  console.log('  property_number:', data?.property_number);
  console.log('  deleted_at:', data?.deleted_at);
  console.log('  name:', data?.name);

  // getByBuyerNumber は deleted_at IS NULL でフィルタする
  // deleted_at が設定されていると null が返る
  const { data: notDeleted, error: err2 } = await supabase
    .from('buyers')
    .select('buyer_number, property_number, deleted_at')
    .eq('buyer_number', 6955)
    .is('deleted_at', null)
    .single();

  console.log('\ndeleted_at IS NULL で検索した結果:');
  if (err2) {
    console.log('  エラー（見つからない）:', err2.message);
    console.log('  → deleted_at が設定されているため getByBuyerNumber が null を返している！');
  } else {
    console.log('  見つかった:', notDeleted?.buyer_number, notDeleted?.property_number);
  }
}

main().catch(console.error);
