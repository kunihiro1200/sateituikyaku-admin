// APIレスポンスを直接確認するスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // getByPropertyNumberと同じクエリ
  const { data, error } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA4029')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('APIレスポンス (seller関連):');
  console.log('  seller_name:', JSON.stringify(data.seller_name));
  console.log('  owner_info:', JSON.stringify(data.owner_info));
  console.log('  seller_address:', JSON.stringify(data.seller_address));
  console.log('  seller_contact:', JSON.stringify(data.seller_contact));
  console.log('  updated_at:', data.updated_at);
}

main().catch(console.error);
