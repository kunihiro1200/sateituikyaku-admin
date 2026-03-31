/**
 * 買主#7261を削除するスクリプト（緊急対応）
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteBuyer7261() {
  console.log('=== 買主#7261を削除 ===\n');

  // 買主#7261を取得
  const { data: buyer, error: fetchError } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7261')
    .single();

  if (fetchError) {
    console.error('エラー:', fetchError);
    return;
  }

  if (!buyer) {
    console.log('買主#7261が見つかりませんでした');
    return;
  }

  console.log(`買主#7261を削除します:`);
  console.log(`名前: ${buyer.name}`);
  console.log(`vendor_survey: ${buyer.vendor_survey}`);

  // ソフトデリート（deleted_atを設定）
  const { error: deleteError } = await supabase
    .from('buyers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('buyer_number', '7261');

  if (deleteError) {
    console.error('削除エラー:', deleteError);
    return;
  }

  console.log('\n✅ 買主#7261を削除しました（deleted_atを設定）');
}

deleteBuyer7261().then(() => {
  console.log('\n=== 削除完了 ===');
  process.exit(0);
}).catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
