import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // 買主7080の詳細を確認
  const { data: buyer } = await supabase
    .from('buyers')
    .select('buyer_number, name, desired_area, desired_property_type, distribution_type, property_number, latest_status, price_range_house, price_range_apartment, price_range_land')
    .eq('buyer_number', '7080')
    .single();
  console.log('Buyer 7080:', JSON.stringify(buyer, null, 2));

  // 買主7080の問い合わせ物件の座標を確認
  if (buyer?.property_number) {
    const firstPropNum = buyer.property_number.split(',')[0].trim();
    console.log('First property number:', firstPropNum);

    const { data: prop } = await supabase
      .from('property_listings')
      .select('property_number, address, latitude, longitude')
      .eq('property_number', firstPropNum)
      .single();
    console.log('Inquiry property:', JSON.stringify(prop, null, 2));

    // AA13774の座標との距離を計算
    const aa13774 = { lat: 33.1847, lng: 131.5962 };
    if (prop?.latitude && prop?.longitude) {
      const R = 6371;
      const dLat = (prop.latitude - aa13774.lat) * Math.PI / 180;
      const dLng = (prop.longitude - aa13774.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(aa13774.lat * Math.PI / 180) * Math.cos(prop.latitude * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      console.log(`Distance from AA13774 to ${firstPropNum}: ${distance.toFixed(2)}km`);
    }
  }
}

check().catch(console.error);
