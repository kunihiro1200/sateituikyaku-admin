const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // 物件AA10027を確認
  const { data: prop, error: propErr } = await supabase
    .from('property_listings')
    .select('property_number, address, price, property_type, distribution_areas, buyer_filter_pet, buyer_filter_parking, buyer_filter_onsen, buyer_filter_floor')
    .eq('property_number', 'AA10027')
    .single();
  
  console.log('=== Property AA10027 ===');
  if (propErr) console.log('Error:', propErr.message);
  else console.log(JSON.stringify(prop, null, 2));

  // 買主7646を確認
  const { data: buyer, error: buyerErr } = await supabase
    .from('buyers')
    .select('buyer_number, name, email, desired_area, distribution_type, latest_status, desired_property_type, price_range_apartment, price_range_house, price_range_land, deleted_at')
    .eq('buyer_number', '7646')
    .single();
  
  console.log('\n=== Buyer 7646 ===');
  if (buyerErr) console.log('Error:', buyerErr.message);
  else console.log(JSON.stringify(buyer, null, 2));
}

main().catch(console.error);
