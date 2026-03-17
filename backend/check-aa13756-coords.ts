import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude, google_map_url, distribution_areas')
    .eq('property_number', 'AA13756')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('AA13756:');
  console.log('  address:', data.address);
  console.log('  latitude:', data.latitude);
  console.log('  longitude:', data.longitude);
  console.log('  google_map_url:', data.google_map_url);
  console.log('  distribution_areas:', data.distribution_areas);
  console.log('  座標あり:', !!(data.latitude && data.longitude));
}

main().catch(console.error);
