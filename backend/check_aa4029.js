// AA4029のDBの状態を確認するスクリプト
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, owner_info')
    .eq('property_number', 'AA4029')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('AA4029 DB状態:');
  console.log('  seller_name:', JSON.stringify(data.seller_name));
  console.log('  owner_info:', JSON.stringify(data.owner_info));
}

main().catch(console.error);
