// AA4029のseller_nameを更新して、updated_atも確認するスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // 更新前の状態
  const { data: before } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info, updated_at')
    .eq('property_number', 'AA4029')
    .single();

  console.log('更新前:');
  console.log('  seller_name:', JSON.stringify(before.seller_name));
  console.log('  owner_info:', JSON.stringify(before.owner_info));
  console.log('  updated_at:', before.updated_at);

  // 更新
  const { error } = await supabase
    .from('property_listings')
    .update({ seller_name: before.owner_info })
    .eq('property_number', 'AA4029');

  if (error) {
    console.error('更新エラー:', error.message);
    return;
  }

  // 更新後の状態
  const { data: after } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info, updated_at')
    .eq('property_number', 'AA4029')
    .single();

  console.log('\n更新後:');
  console.log('  seller_name:', JSON.stringify(after.seller_name));
  console.log('  owner_info:', JSON.stringify(after.owner_info));
  console.log('  updated_at:', after.updated_at);
}

main().catch(console.error);
