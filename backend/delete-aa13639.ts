import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sellerNumber = 'AA13639';
  
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

  if (seller.deleted_at) {
    console.log('既にソフトデリート済みです');
    return;
  }

  const { error } = await supabase
    .from('sellers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('seller_number', sellerNumber);

  if (error) {
    console.error('削除エラー:', error.message);
    return;
  }

  console.log(`✅ ${sellerNumber} をソフトデリートしました`);
}

main();
