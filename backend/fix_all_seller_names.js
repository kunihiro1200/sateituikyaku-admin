// owner_infoに値があるがseller_nameがnullの物件を一括修正するスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // owner_infoに値があるがseller_nameがnullの物件を取得
  const { data: properties, error: fetchError } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info')
    .not('owner_info', 'is', null)
    .is('seller_name', null);

  if (fetchError) {
    console.error('取得エラー:', fetchError.message);
    return;
  }

  console.log(`対象物件数: ${properties.length}件`);
  
  if (properties.length === 0) {
    console.log('修正対象なし');
    return;
  }

  properties.forEach(p => {
    console.log(`  ${p.property_number}: owner_info="${p.owner_info}"`);
  });

  // 一括更新
  let successCount = 0;
  let failCount = 0;

  for (const prop of properties) {
    const { error: updateError } = await supabase
      .from('property_listings')
      .update({ seller_name: prop.owner_info })
      .eq('property_number', prop.property_number);

    if (updateError) {
      console.error(`❌ ${prop.property_number} 更新失敗:`, updateError.message);
      failCount++;
    } else {
      console.log(`✅ ${prop.property_number}: seller_name = "${prop.owner_info}"`);
      successCount++;
    }
  }

  console.log(`\n完了: 成功${successCount}件, 失敗${failCount}件`);
}

main().catch(console.error);
