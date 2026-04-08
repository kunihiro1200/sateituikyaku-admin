import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testBuyerSearch() {
  console.log('=== Testing buyer search for 7291 and 7187 ===');
  
  const buyerNumbers = ['7291', '7187'];
  
  for (const buyerNumber of buyerNumbers) {
    console.log(`\n--- Buyer ${buyerNumber} ---`);
    
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, desired_area, desired_property_type, price_range_apartment, latest_status, desired_area_lat, desired_area_lng')
      .eq('buyer_number', buyerNumber)
      .single();
    
    if (error) {
      console.log('Error:', error);
      continue;
    }
    
    console.log('Buyer data:', JSON.stringify(buyer, null, 2));
    
    // チェック項目
    console.log('\nChecks:');
    console.log('- Has coordinates:', buyer.desired_area_lat !== null && buyer.desired_area_lng !== null);
    console.log('- Property type includes マンション:', buyer.desired_property_type?.includes('マンション'));
    console.log('- Latest status:', buyer.latest_status);
    console.log('- Status includes 買:', buyer.latest_status?.includes('買'));
    console.log('- Status starts with D:', buyer.latest_status?.startsWith('D'));
    console.log('- Price range (apartment):', buyer.price_range_apartment);
    
    // 価格帯チェック
    if (buyer.price_range_apartment) {
      const match = buyer.price_range_apartment.match(/(\d+)万円/g);
      if (match) {
        const prices = match.map(m => parseInt(m.replace('万円', '')) * 10000);
        console.log('- Parsed prices:', prices);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        console.log('- Min:', min, 'Max:', max);
        console.log('- Matches 1000~2999万:', min >= 10000000 && max <= 29990000);
      }
    }
  }
  
  // 「大分市大津町」の座標を取得
  console.log('\n--- Geocoding 大分市大津町 ---');
  const { GeocodingService } = await import('./src/services/GeocodingService');
  const geocodingService = new GeocodingService();
  const coordinates = await geocodingService.geocodeAddress('大分市大津町');
  console.log('Coordinates:', coordinates);
  
  if (coordinates) {
    // 各買主との距離を計算
    for (const buyerNumber of buyerNumbers) {
      const { data: buyer } = await supabase
        .from('buyers')
        .select('buyer_number, name, desired_area_lat, desired_area_lng')
        .eq('buyer_number', buyerNumber)
        .single();
      
      if (buyer && buyer.desired_area_lat && buyer.desired_area_lng) {
        const distance = geocodingService.calculateDistance(
          coordinates.lat,
          coordinates.lng,
          buyer.desired_area_lat,
          buyer.desired_area_lng
        );
        console.log(`\nDistance to ${buyerNumber} (${buyer.name}): ${distance.toFixed(2)} km`);
        console.log('Within 3km:', distance <= 3);
      }
    }
  }
}

testBuyerSearch().catch(console.error);
