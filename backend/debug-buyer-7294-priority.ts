import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debugBuyer7294Priority() {
  console.log('[debug-buyer-7294-priority] ===== START =====');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', 7294)
    .single();
  
  if (error) {
    console.error('[debug-buyer-7294-priority] Error:', error);
    return;
  }
  
  console.log('[debug-buyer-7294-priority] Buyer 7294 relevant fields:');
  console.log('  buyer_number:', data.buyer_number);
  console.log('  three_calls_confirmed:', data.three_calls_confirmed);
  console.log('  inquiry_email_phone:', data.inquiry_email_phone);
  console.log('  inquiry_email_reply:', data.inquiry_email_reply);
  console.log('  next_call_date:', data.next_call_date);
  console.log('  follow_up_assignee:', data.follow_up_assignee);
  console.log('  latest_viewing_date:', data.latest_viewing_date);
  console.log('  viewing_date:', data.viewing_date);
  console.log('  valuation_survey:', data.valuation_survey);
  console.log('  valuation_survey_confirmed:', data.valuation_survey_confirmed);
  console.log('  vendor_survey:', data.vendor_survey);
  console.log('  broker_inquiry:', data.broker_inquiry);
  console.log('  notification_sender:', data.notification_sender);
  console.log('  viewing_unconfirmed:', data.viewing_unconfirmed);
  console.log('  post_viewing_seller_contact:', data.post_viewing_seller_contact);
  console.log('  atbb_status:', data.atbb_status);
  
  const statusResult = calculateBuyerStatus(data);
  
  console.log('[debug-buyer-7294-priority] Calculated status:');
  console.log('  status:', statusResult.status);
  console.log('  priority:', statusResult.priority);
  console.log('  matchedCondition:', statusResult.matchedCondition);
  console.log('  color:', statusResult.color);
  
  // 「３回架電未」の条件を手動でチェック
  console.log('[debug-buyer-7294-priority] Manual check for "3回架電未" condition:');
  console.log('  three_calls_confirmed === "3回架電未":', data.three_calls_confirmed === '3回架電未');
  console.log('  inquiry_email_phone === "不通":', data.inquiry_email_phone === '不通');
  console.log('  inquiry_email_phone === "未":', data.inquiry_email_phone === '未');
  console.log('  Should match "3回架電未":', 
    data.three_calls_confirmed === '3回架電未' && 
    (data.inquiry_email_phone === '不通' || data.inquiry_email_phone === '未')
  );
  
  console.log('[debug-buyer-7294-priority] ===== END =====');
}

debugBuyer7294Priority();
