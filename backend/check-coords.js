const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // latitude/longitudeが入っている物件数
  const { count: withCoords } = await supabase
    .from('property_listings')
    .select('*', { count: 'exact', head: true })
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  // google_map_urlが入っている物件数
  const { count: withMapUrl } = await supabase
    .from('property_listings')
    .select('*', { count: 'exact', head: true })
    .not('google_map_url', 'is', null)
    .neq('google_map_url', '');

  // 全物件数
  const { count: total } = await supabase
    .from('property_listings')
    .select('*', { count: 'exact', head: true });

  console.log(`全物件数: ${total}`);
  console.log(`latitude/longitude あり: ${withCoords}`);
  console.log(`google_map_url あり: ${withMapUrl}`);

  // google_map_urlのサンプル
  const { data: samples } = await supabase
    .from('property_listings')
    .select('property_number, address, google_map_url, latitude, longitude')
    .not('google_map_url', 'is', null)
    .neq('google_map_url', '')
    .limit(3);

  console.log('\ngoogle_map_urlサンプル:');
  samples?.forEach(s => console.log(`  ${s.property_number}: ${s.google_map_url?.substring(0, 80)}`));
  console.log('  lat/lng:', samples?.[0]?.latitude, samples?.[0]?.longitude);
}

main().catch(console.error);
