// AA4029の同期状態を詳しく確認するスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // 全フィールドを取得
  const { data, error } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA4029')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('AA4029 全フィールド:');
  console.log('  seller_name:', JSON.stringify(data.seller_name));
  console.log('  owner_info:', JSON.stringify(data.owner_info));
  console.log('  updated_at:', data.updated_at);
  
  // seller_nameがnullのままの理由を分析
  console.log('\n分析:');
  console.log('  owner_info に値あり:', data.owner_info ? 'YES' : 'NO');
  console.log('  seller_name が null:', data.seller_name === null ? 'YES' : 'NO');
  console.log('  → フォールバックロジックが機能していれば seller_name = "' + data.owner_info + '" になるはず');
  console.log('  → 同期が走っていないか、変更として検出されていない可能性');
}

main().catch(console.error);
