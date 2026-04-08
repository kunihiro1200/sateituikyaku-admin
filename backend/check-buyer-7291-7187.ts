import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyers() {
  console.log('=== Checking buyers 7291 and 7187 ===');
  
  const buyerNumbers = ['7291', '7187'];
  
  for (const buyerNumber of buyerNumbers) {
    console.log(`\n--- Buyer ${buyerNumber} ---`);
    
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', buyerNumber)
      .single();
    
    if (error) {
      console.log('Error:', error);
      continue;
    }
    
    console.log('Buyer data:');
    console.log('- buyer_number:', buyer.buyer_number);
    console.log('- name:', buyer.name);
    console.log('- desired_area:', buyer.desired_area);
    console.log('- desired_area_lat:', buyer.desired_area_lat);
    console.log('- desired_area_lng:', buyer.desired_area_lng);
    console.log('- desired_property_type:', buyer.desired_property_type);
    console.log('- price_range_apartment:', buyer.price_range_apartment);
    console.log('- latest_status:', buyer.latest_status);
    console.log('- reception_date:', buyer.reception_date);
    console.log('- deleted_at:', buyer.deleted_at);
  }
  
  // 「大分市大津町」の座標
  console.log('\n--- Search coordinates ---');
  console.log('大分市大津町: lat=33.2494551, lng=131.6242579');
  
  // 買主7291の座標
  console.log('\n--- Buyer 7291 coordinates ---');
  console.log('lat=33.2382, lng=131.6126');
  
  // 距離計算（簡易版）
  const searchLat = 33.2494551;
  const searchLng = 131.6242579;
  const buyerLat = 33.2382;
  const buyerLng = 131.6126;
  
  const R = 6371; // 地球の半径（km）
  const dLat = (buyerLat - searchLat) * Math.PI / 180;
  const dLng = (buyerLng - searchLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(searchLat * Math.PI / 180) * Math.cos(buyerLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  console.log('Distance:', distance.toFixed(2), 'km');
  console.log('Within 3km:', distance <= 3);
}

checkBuyers().catch(console.error);
