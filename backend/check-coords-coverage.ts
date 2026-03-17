// property_listingsの座標カバレッジを確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, latitude, longitude, google_map_url');

  if (error || !data) {
    console.error(error);
    return;
  }

  const total = data.length;
  const hasCoords = data.filter(d => d.latitude != null && d.longitude != null).length;
  const hasGoogleMapUrl = data.filter(d => d.google_map_url).length;
  const hasNeitherCoords = data.filter(d => d.latitude == null && d.longitude == null).length;
  const hasGoogleMapUrlButNoCoords = data.filter(d => d.google_map_url && (d.latitude == null || d.longitude == null)).length;

  console.log(`総物件数: ${total}`);
  console.log(`座標あり (latitude/longitude): ${hasCoords}`);
  console.log(`google_map_url あり: ${hasGoogleMapUrl}`);
  console.log(`座標なし: ${hasNeitherCoords}`);
  console.log(`google_map_urlあり・座標なし: ${hasGoogleMapUrlButNoCoords}`);
}

check().catch(console.error);
