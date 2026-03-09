import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('=== AA13595 削除ブロック調査 ===\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number, status, deleted_at, contract_year_month, updated_at')
    .eq('seller_number', 'AA13595')
    .single();

  if (error || !seller) {
    console.log('売主が見つからない:', error?.message);
    return;
  }

  console.log('seller_number:', seller.seller_number);
  console.log('status:', seller.status);
  console.log('deleted_at:', seller.deleted_at);
  console.log('contract_year_month:', seller.contract_year_month);
  console.log('updated_at:', seller.updated_at);
  console.log('id:', seller.id);

  // アクティブな物件リストを確認
  const { data: listings } = await supabase
    .from('property_listings')
    .select('id, property_number, deleted_at')
    .eq('seller_id', seller.id);

  console.log('\n--- property_listings ---');
  console.log('全件数:', listings?.length || 0);
  const active = listings?.filter(l => !l.deleted_at) || [];
  console.log('アクティブ件数:', active.length);
  if (active.length > 0) {
    active.forEach(l => console.log('  アクティブ:', l.property_number || l.id));
    console.log('\n→ ❌ property_listingsがあるため削除ブロックされている');
  } else {
    console.log('\n→ ✅ アクティブな物件リストなし');
  }

  // 専任・一般契約中チェック
  const activeContractStatuses = ['専任契約中', '一般契約中'];
  if (activeContractStatuses.includes(seller.status)) {
    console.log('\n→ ❌ アクティブな契約ステータスのため削除ブロックされている:', seller.status);
  } else {
    console.log('\n→ ✅ 契約ステータスは問題なし:', seller.status);
  }

  // 環境変数確認
  console.log('\n--- 環境変数 ---');
  console.log('DELETION_SYNC_ENABLED:', process.env.DELETION_SYNC_ENABLED);
  console.log('DELETION_VALIDATION_STRICT:', process.env.DELETION_VALIDATION_STRICT);
  console.log('SELLER_SYNC_ENABLED:', process.env.SELLER_SYNC_ENABLED);
}

check().catch(console.error);
