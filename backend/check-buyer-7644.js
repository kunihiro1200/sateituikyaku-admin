const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
console.log('URL:', url ? 'OK' : 'MISSING');
console.log('KEY:', key ? 'OK' : 'MISSING');

if (!url || !key) { process.exit(1); }

const supabase = createClient(url, key);

async function main() {
  const { data: b, error: e1 } = await supabase
    .from('buyers')
    .select('buyer_number,desired_area,desired_property_type,distribution_type,latest_status,email,price_range_apartment,deleted_at')
    .eq('buyer_number', '7644')
    .single();
  console.log('BUYER:', JSON.stringify(b, null, 2));
  if (e1) console.log('BUYER ERROR:', e1.message);

  const { data: p, error: e2 } = await supabase
    .from('property_listings')
    .select('property_number,property_type,sales_price,distribution_areas')
    .eq('property_number', 'AA18')
    .single();
  console.log('PROPERTY:', JSON.stringify(p, null, 2));
  if (e2) console.log('PROPERTY ERROR:', e2.message);
}

main().catch(e => console.log('ERROR:', e.message));
