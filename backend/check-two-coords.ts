import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude')
    .in('property_number', ['AA12530', 'AA13774']);
  console.log(JSON.stringify(data, null, 2));

  // 距離計算
  if (data && data.length === 2) {
    const a = data.find(d => d.property_number === 'AA13774');
    const b = data.find(d => d.property_number === 'AA12530');
    if (a && b && a.latitude && b.latitude) {
      const R = 6371;
      const dLat = (b.latitude - a.latitude) * Math.PI / 180;
      const dLon = (b.longitude - a.longitude) * Math.PI / 180;
      const lat1 = a.latitude * Math.PI / 180;
      const lat2 = b.latitude * Math.PI / 180;
      const x = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
      const dist = R * c;
      console.log(`\nAA13774 ↔ AA12530 の距離: ${dist.toFixed(2)}km`);
    }
  }
}

check().catch(console.error);
