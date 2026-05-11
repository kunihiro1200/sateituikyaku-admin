// 特定の物件の売主名を確認するスクリプト
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// コマンドライン引数から物件番号を取得
const propertyNumber = process.argv[2];

if (!propertyNumber) {
  console.log('使用方法: node check-specific-property.js <物件番号>');
  console.log('例: node check-specific-property.js AA5279');
  process.exit(1);
}

(async () => {
  console.log(`=== 物件番号: ${propertyNumber} の売主名確認 ===\n`);

  // property_listingsから取得
  const { data: property, error } = await supabase
    .from('property_listings')
    .select('property_number, address, seller_name, owner_info')
    .eq('property_number', propertyNumber)
    .single();

  if (error) {
    console.error('エラー:', error.message);
    return;
  }

  if (!property) {
    console.log('物件が見つかりませんでした');
    return;
  }

  console.log('物件番号:', property.property_number);
  console.log('住所:', property.address);
  console.log('seller_name (O列):', property.seller_name || '(空)');
  console.log('owner_info (BL列):', property.owner_info || '(空)');
  console.log('');

  // フォールバックロジックの結果
  const trimmed = (property.seller_name || '').trim();
  const isBlankOrSamaOnly = !trimmed || trimmed === '様';
  const effectiveName = isBlankOrSamaOnly ? (property.owner_info || null) : trimmed;

  console.log('');
  console.log('=== フォールバックロジック結果 ===');
  console.log('使用される売主名:', effectiveName || '(なし)');
})();
