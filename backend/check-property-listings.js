const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // カラム確認
  const { data: sample, error: e1 } = await supabase.from('property_listings').select('*').limit(1);
  if (e1) { console.error('Error:', e1); return; }
  if (sample && sample[0]) {
    console.log('カラム一覧:', Object.keys(sample[0]).join(', '));
    console.log('サンプル住所:', sample[0].address);
  }

  // 徳島を含む物件を検索
  const { data: tokushima, error: e2 } = await supabase
    .from('property_listings')
    .select('property_number, address, property_type, price, atbb_status, latitude, longitude')
    .ilike('address', '%徳島%');
  
  console.log('\n徳島を含む物件:', tokushima?.length || 0, '件');
  if (tokushima) {
    tokushima.forEach(p => console.log(`  ${p.property_number}: ${p.address} (${p.atbb_status})`));
  }

  // 大分市の公開中物件数
  const { data: oita, error: e3 } = await supabase
    .from('property_listings')
    .select('property_number, address, atbb_status')
    .ilike('address', '%大分市%')
    .or('atbb_status.ilike.%公開中%,atbb_status.ilike.%公開前%')
    .limit(5);
  
  console.log('\n大分市の公開中/公開前物件（最初の5件）:');
  if (oita) {
    oita.forEach(p => console.log(`  ${p.property_number}: ${p.address} (${p.atbb_status})`));
  }
}

main().catch(console.error);
