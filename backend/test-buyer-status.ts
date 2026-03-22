/**
 * 6954・7119のステータス計算テスト
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testBuyerStatus(buyerNumber: string) {
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', buyerNumber)
    .single();

  if (error || !data) {
    console.log(`[${buyerNumber}] 取得エラー:`, error?.message);
    return;
  }

  console.log(`\n=== 買主 ${buyerNumber} ===`);
  console.log('next_call_date:', data.next_call_date);
  console.log('follow_up_assignee:', data.follow_up_assignee);
  console.log('latest_viewing_date:', data.latest_viewing_date);
  console.log('viewing_result_follow_up:', data.viewing_result_follow_up);
  console.log('three_calls_confirmed:', data.three_calls_confirmed);
  console.log('inquiry_email_phone:', data.inquiry_email_phone);
  console.log('inquiry_email_reply:', data.inquiry_email_reply);
  console.log('latest_status:', data.latest_status);
  console.log('broker_inquiry:', data.broker_inquiry);
  console.log('viewing_unconfirmed:', data.viewing_unconfirmed);
  console.log('valuation_survey:', data.valuation_survey);
  console.log('broker_survey:', data.broker_survey);

  const result = calculateBuyerStatus(data);
  console.log('\n→ 計算結果:', JSON.stringify(result, null, 2));
}

async function main() {
  await testBuyerStatus('6954');
  await testBuyerStatus('7119');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
