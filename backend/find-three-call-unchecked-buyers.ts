import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function findThreeCallUncheckedBuyers() {
  console.log('[find-three-call-unchecked-buyers] ===== START =====');
  
  // 全買主を取得（制限なし）
  let allBuyers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('buyers')
      .select('*')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('[find-three-call-unchecked-buyers] Error:', error);
      return;
    }
    
    if (!batch || batch.length === 0) {
      break;
    }
    
    allBuyers = allBuyers.concat(batch);
    
    if (batch.length < batchSize) {
      break;
    }
    
    from += batchSize;
  }
  
  const buyers = allBuyers;
  
  console.log(`[find-three-call-unchecked-buyers] Total buyers: ${buyers.length}`);
  
  // 買主7294が含まれているか確認
  console.log('[find-three-call-unchecked-buyers] Searching for buyer 7294...');
  console.log('[find-three-call-unchecked-buyers] Sample buyer_numbers:', buyers.slice(0, 10).map(b => `${b.buyer_number} (type: ${typeof b.buyer_number})`));
  const buyer7294 = buyers.find(b => {
    const matches = b.buyer_number === '7294' || b.buyer_number === 7294 || String(b.buyer_number) === '7294';
    if (matches) {
      console.log('[find-three-call-unchecked-buyers] Found buyer 7294!');
    }
    return matches;
  });
  console.log('[find-three-call-unchecked-buyers] Buyer 7294 found:', !!buyer7294);
  if (buyer7294) {
    console.log('[find-three-call-unchecked-buyers] Buyer 7294 data:');
    console.log('  three_calls_confirmed:', buyer7294.three_calls_confirmed);
    console.log('  inquiry_email_phone:', buyer7294.inquiry_email_phone);
    
    const statusResult = calculateBuyerStatus(buyer7294);
    console.log('[find-three-call-unchecked-buyers] Buyer 7294 calculated status:', statusResult.status);
  }
  
  // 各買主のステータスを計算
  const buyersWithStatus = buyers.map(b => {
    const statusResult = calculateBuyerStatus(b);
    return {
      ...b,
      calculated_status: statusResult.status,
      status_priority: statusResult.priority,
    };
  });
  
  // 「３回架電未」カテゴリの買主を抽出
  const threeCallUncheckedBuyers = buyersWithStatus.filter(b => b.calculated_status === '3回架電未');
  
  console.log(`[find-three-call-unchecked-buyers] "3回架電未" buyers count: ${threeCallUncheckedBuyers.length}`);
  
  if (threeCallUncheckedBuyers.length > 0) {
    console.log('[find-three-call-unchecked-buyers] "3回架電未" buyers:');
    threeCallUncheckedBuyers.forEach(b => {
      console.log(`  - ${b.buyer_number}: ${b.name}`);
    });
  }
  
  console.log('[find-three-call-unchecked-buyers] ===== END =====');
}

findThreeCallUncheckedBuyers();
