import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkAA9484() {
  console.log('=== AA9484の営業担当確認 ===\n');

  // DBから取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, updated_at')
    .eq('seller_number', 'AA9484')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!seller) {
    console.log('❌ AA9484が見つかりません');
    return;
  }

  console.log('📊 DB状態:');
  console.log('  売主番号:', seller.seller_number);
  console.log('  営業担当 (visit_assignee):', seller.visit_assignee === null ? 'null' : `"${seller.visit_assignee}"`);
  console.log('  更新日時:', seller.updated_at);
  console.log('');

  if (seller.visit_assignee === null) {
    console.log('✅ DBでは既にnullになっています');
    console.log('');
    console.log('💡 考えられる原因:');
    console.log('  1. 以前の同期で既にnullに更新されている');
    console.log('  2. スプレッドシートの「外す」が最近入力された');
    console.log('  3. 10分トリガーの syncSellerList() で既に同期済み');
  } else {
    console.log('⚠️ DBではまだnullになっていません');
    console.log(`   現在の値: "${seller.visit_assignee}"`);
  }
}

checkAA9484().catch(console.error);
