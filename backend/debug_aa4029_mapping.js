// AA4029のスプレッドシートデータのマッピングをデバッグするスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // DBの現在の状態を確認
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info, updated_at')
    .eq('property_number', 'AA4029')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('現在のDB状態:');
  console.log('  seller_name:', JSON.stringify(data.seller_name));
  console.log('  owner_info:', JSON.stringify(data.owner_info));
  console.log('  updated_at:', data.updated_at);
  
  // フォールバックロジックをシミュレート
  const ownerInfo = data.owner_info;
  const sellerNameFromO = null; // O列が空欄
  const fallback = ownerInfo || sellerNameFromO || null;
  
  console.log('\nフォールバックシミュレーション:');
  console.log('  owner_info:', JSON.stringify(ownerInfo));
  console.log('  O列seller_name:', JSON.stringify(sellerNameFromO));
  console.log('  フォールバック結果:', JSON.stringify(fallback));
}

main().catch(console.error);
