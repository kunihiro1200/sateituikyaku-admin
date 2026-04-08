// 既存の買主の希望エリアから座標を取得して保存するバッチ処理
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GeocodingService } from '../src/services/GeocodingService';

// .env.localから環境変数を読み込む
config({ path: '.env.local' });

// 直接値を指定（環境変数の読み込み順序の問題を回避）
const SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// GOOGLE_MAPS_API_KEYを明示的に設定
process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyCjK1gbrfWUQ5uuvd_3VOZVvTFjQVmxP3E';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY ? 'Set' : 'Not set');

async function backfillBuyerCoordinates() {
  console.log('Starting buyer coordinates backfill...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const geocodingService = new GeocodingService();
  
  // 1. desired_areaがあり、座標がない買主を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, desired_area')
    .not('desired_area', 'is', null)
    .is('desired_area_lat', null)
    .is('deleted_at', null);
  
  if (error) {
    console.error('Failed to fetch buyers:', error);
    return;
  }
  
  console.log(`Found ${buyers?.length || 0} buyers without coordinates`);
  
  if (!buyers || buyers.length === 0) {
    console.log('No buyers to process');
    return;
  }
  
  // 実際の住所が含まれている買主のみをフィルタリング
  // 丸数字や記号のみの場合はスキップ
  const validBuyers = buyers.filter(buyer => {
    const area = buyer.desired_area || '';
    // 3文字以上、かつ漢字・ひらがな・カタカナを含む
    return area.length >= 3 && /[一-龯ぁ-んァ-ヶ]/.test(area);
  });
  
  console.log(`Filtered to ${validBuyers.length} buyers with valid addresses`);
  
  // 全件処理（120件）
  const TEST_LIMIT = 120;
  const buyersToProcess = validBuyers.slice(0, TEST_LIMIT);
  console.log(`Processing first ${buyersToProcess.length} buyers for testing`);
  
  // 2. 各買主の希望エリアをジオコーディング
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < buyersToProcess.length; i++) {
    const buyer = buyersToProcess[i];
    console.log(`\n[${i + 1}/${buyersToProcess.length}] Processing buyer ${buyer.buyer_number}: ${buyer.desired_area}`);
    
    try {
      const coordinates = await geocodingService.geocodeAddress(buyer.desired_area);
      
      if (coordinates) {
        // 座標を保存
        const { error: updateError } = await supabase
          .from('buyers')
          .update({
            desired_area_lat: coordinates.lat,
            desired_area_lng: coordinates.lng,
          })
          .eq('buyer_number', buyer.buyer_number);
        
        if (updateError) {
          console.error(`  ❌ Failed to update: ${updateError.message}`);
          failCount++;
        } else {
          console.log(`  ✅ Success: (${coordinates.lat}, ${coordinates.lng})`);
          successCount++;
        }
      } else {
        console.log(`  ⚠️  Geocoding failed (no coordinates returned)`);
        failCount++;
      }
      
      // レート制限対策：200msの遅延
      if (i < buyersToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total valid buyers: ${validBuyers.length}`);
  console.log(`Total skipped (invalid addresses): ${buyers.length - validBuyers.length}`);
  console.log(`Processed (test limit): ${buyersToProcess.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

backfillBuyerCoordinates()
  .then(() => {
    console.log('\nBackfill completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  });
