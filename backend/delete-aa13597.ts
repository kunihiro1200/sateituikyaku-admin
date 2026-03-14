import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sellerNumber = 'AA13597';

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, seller_number, status, deleted_at')
    .eq('seller_number', sellerNumber)
    .single();

  if (!seller) {
    console.log(`${sellerNumber} が見つかりません`);
    return;
  }

  console.log('現在の状態:', seller);

  // 完全削除（ハードデリート）
  const { error } = await supabase
    .from('sellers')
    .delete()
    .eq('seller_number', sellerNumber);

  if (error) {
    console.error('削除エラー:', error.message);
    return;
  }

  console.log(`✅ ${sellerNumber} を完全削除しました`);
}

main();
