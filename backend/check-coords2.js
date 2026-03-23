const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // google_map_urlのサンプルだけ確認
  const { data: samples, error } = await supabase
    .from('property_listings')
    .select('property_number, address, google_map_url, latitude, longitude')
    .not('google_map_url', 'is', null)
    .neq('google_map_url', '')
    .limit(5);

  if (error) { console.error(error); return; }

  console.log('google_map_urlサンプル:');
  samples?.forEach(s => {
    console.log(`  ${s.property_number}: lat=${s.latitude}, lng=${s.longitude}`);
    console.log(`    url: ${s.google_map_url?.substring(0, 100)}`);
  });
}

main().catch(console.error);
