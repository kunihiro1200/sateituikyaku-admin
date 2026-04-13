// AA4029のseller_nameをowner_infoの値で直接更新するスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // 現在の状態を確認
  const { data: current, error: fetchError } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info')
    .eq('property_number', 'AA4029')
    .single();

  if (fetchError) {
    console.error('取得エラー:', fetchError.message);
    return;
  }

  console.log('更新前:');
  console.log('  seller_name:', JSON.stringify(current.seller_name));
  console.log('  owner_info:', JSON.stringify(current.owner_info));

  // owner_info の値で seller_name を更新
  const newSellerName = current.owner_info || null;
  
  if (!newSellerName) {
    console.log('owner_info が空のため更新をスキップ');
    return;
  }

  const { error: updateError } = await supabase
    .from('property_listings')
    .update({ seller_name: newSellerName })
    .eq('property_number', 'AA4029');

  if (updateError) {
    console.error('更新エラー:', updateError.message);
    return;
  }

  console.log('\n更新後:');
  console.log('  seller_name:', JSON.stringify(newSellerName));
  console.log('✅ AA4029 の seller_name を "' + newSellerName + '" に更新しました');
}

main().catch(console.error);
