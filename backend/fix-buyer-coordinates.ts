// 買主7291と7187の座標を手動で設定するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixBuyerCoordinates() {
  console.log('=== Fixing buyer coordinates for 7291 and 7187 ===');
  
  // 買主7291と7187の希望エリアは「①中学校（王子、碩田学園、大分西）」
  // これは大分市の中心部を指すため、大分市役所の座標を使用
  // 大分市役所: 33.2382, 131.6126
  
  const buyers = [
    { buyer_number: '7291', lat: 33.2382, lng: 131.6126 },
    { buyer_number: '7187', lat: 33.2382, lng: 131.6126 },
  ];
  
  for (const buyer of buyers) {
    console.log(`\nUpdating buyer ${buyer.buyer_number}...`);
    
    const { error } = await supabase
      .from('buyers')
      .update({
        desired_area_lat: buyer.lat,
        desired_area_lng: buyer.lng,
      })
      .eq('buyer_number', buyer.buyer_number);
    
    if (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    } else {
      console.log(`  ✅ Success: (${buyer.lat}, ${buyer.lng})`);
    }
  }
  
  console.log('\n=== Done ===');
}

fixBuyerCoordinates().catch(console.error);
