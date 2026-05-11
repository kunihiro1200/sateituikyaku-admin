// 物件リストの売主名問題を調査するスクリプト
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('=== 物件リストの売主名問題調査 ===\n');

  // AA5279の物件リスト情報を取得
  const { data: property, error } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info, address')
    .eq('property_number', 'AA5279')
    .single();

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log('物件番号:', property.property_number);
  console.log('住所:', property.address);
  console.log('seller_name (O列):', property.seller_name || '(空)');
  console.log('owner_info (BL列):', property.owner_info || '(空)');
  console.log('');

  // 問題の診断
  if (!property.seller_name && property.owner_info) {
    console.log('❌ 問題発見: seller_nameが空だが、owner_infoには値がある');
    console.log('   → Gmail送信時にowner_infoにフォールバックする必要がある');
  } else if (!property.seller_name && !property.owner_info) {
    console.log('❌ 問題発見: seller_nameもowner_infoも空');
    console.log('   → スプレッドシートのO列とBL列を確認する必要がある');
  } else if (property.seller_name === '様') {
    console.log('❌ 問題発見: seller_nameが"様"のみ');
    console.log('   → owner_infoにフォールバックする必要がある');
  } else {
    console.log('✅ seller_nameは正しく設定されている');
  }

  console.log('');

  // 他の物件でも同じ問題がないか確認
  const { data: allProperties } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info')
    .or('seller_name.is.null,seller_name.eq.様')
    .not('owner_info', 'is', null)
    .limit(10);

  if (allProperties && allProperties.length > 0) {
    console.log(`他にも${allProperties.length}件の物件で同じ問題が発生しています：`);
    allProperties.forEach(p => {
      console.log(`  - ${p.property_number}: seller_name="${p.seller_name || '(空)'}", owner_info="${p.owner_info}"`);
    });
  } else {
    console.log('他の物件では問題は見つかりませんでした。');
  }
})();
