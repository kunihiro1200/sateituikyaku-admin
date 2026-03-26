import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const cleanUrl = process.env.SUPABASE_URL!;
const cleanKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(cleanUrl, cleanKey);

async function main() {
  const { data, error } = await supabase
    .from('area_map_config')
    .select('area_number, google_map_url, coordinates')
    .in('area_number', ['⑨', '⑩', '⑭'])
    .order('area_number');

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const row of data || []) {
    console.log(`\nエリア: ${row.area_number}`);
    console.log(`Google Map URL: ${row.google_map_url}`);
    console.log(`座標: ${JSON.stringify(row.coordinates)}`);
    if (row.coordinates) {
      const c = typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : row.coordinates;
      if (c?.lat && c?.lng) {
        console.log(`Google Maps確認URL: https://www.google.com/maps?q=${c.lat},${c.lng}`);
      }
    }
  }
}

main();
