import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check(sellerNumber: string) {
  console.log(`\n=== ${sellerNumber} ===`);
  
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, seller_number, status, deleted_at')
    .eq('seller_number', sellerNumber)
    .single();

  if (!seller) {
    console.log('売主が見つからない');
    return;
  }

  console.log('status:', seller.status);
  console.log('deleted_at:', seller.deleted_at);

  const { data: listings } = await supabase
    .from('property_listings')
    .select('id, property_number')
    .eq('seller_id', seller.id)
    .is('deleted_at', null);

  console.log('アクティブな物件リスト:', listings?.length || 0, '件');
  if (listings && listings.length > 0) {
    listings.forEach(l => console.log('  -', l.property_number || l.id));
    console.log('→ ❌ property_listingsがあるため削除ブロックされている');
  } else {
    console.log('→ ✅ 物件リストなし（削除可能なはず）');
  }
}

async function main() {
  await check('AA13636');
  await check('AA13638');
}

main();
