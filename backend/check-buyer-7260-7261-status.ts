/**
 * 買主#7260と#7261のステータスを確認するスクリプト
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyerStatus() {
  console.log('=== 買主#7260と#7261のステータス確認 ===\n');

  // 買主#7260と#7261を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*')
    .in('buyer_number', ['7260', '7261'])
    .order('buyer_number');

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (!buyers || buyers.length === 0) {
    console.log('買主が見つかりませんでした');
    return;
  }

  for (const buyer of buyers) {
    console.log(`\n--- 買主#${buyer.buyer_number} ---`);
    console.log(`名前: ${buyer.name}`);
    console.log(`vendor_survey: ${buyer.vendor_survey}`);
    console.log(`broker_survey: ${buyer.broker_survey}`);
    console.log(`broker_inquiry: ${buyer.broker_inquiry}`);
    console.log(`latest_viewing_date: ${buyer.latest_viewing_date}`);
    console.log(`viewing_type_general: ${buyer.viewing_type_general}`);
    console.log(`post_viewing_seller_contact: ${buyer.post_viewing_seller_contact}`);
    console.log(`viewing_result_follow_up: ${buyer.viewing_result_follow_up}`);
    console.log(`atbb_status: ${buyer.atbb_status}`);
    console.log(`follow_up_assignee: ${buyer.follow_up_assignee}`);
    console.log(`next_call_date: ${buyer.next_call_date}`);

    // ステータスを計算
    const statusResult = calculateBuyerStatus(buyer);
    console.log(`\n計算されたステータス: ${statusResult.status}`);
    console.log(`優先度: ${statusResult.priority}`);
    console.log(`条件: ${statusResult.matchedCondition}`);
    console.log(`色: ${statusResult.color}`);
  }
}

checkBuyerStatus().then(() => {
  console.log('\n=== 確認完了 ===');
  process.exit(0);
}).catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
