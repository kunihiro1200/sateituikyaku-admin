import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyerSidebarCounts() {
  console.log('[check-buyer-sidebar-counts] ===== START =====');
  
  // 全買主を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*');
  
  if (error) {
    console.error('[check-buyer-sidebar-counts] Error:', error);
    return;
  }
  
  console.log(`[check-buyer-sidebar-counts] Total buyers: ${buyers.length}`);
  
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
  
  console.log(`[check-buyer-sidebar-counts] 「３回架電未」カテゴリの買主数: ${threeCallUncheckedBuyers.length}`);
  console.log('[check-buyer-sidebar-counts] 「３回架電未」カテゴリの買主:');
  threeCallUncheckedBuyers.forEach(b => {
    console.log(`  - ${b.buyer_number}: ${b.name}, three_calls_confirmed="${b.three_calls_confirmed}", inquiry_email_phone="${b.inquiry_email_phone}"`);
  });
  
  console.log('[check-buyer-sidebar-counts] ===== END =====');
}

checkBuyerSidebarCounts();
