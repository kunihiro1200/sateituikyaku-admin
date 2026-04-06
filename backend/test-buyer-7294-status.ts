import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testBuyer7294Status() {
  console.log('[test-buyer-7294-status] ===== START =====');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', 7294)
    .single();
  
  if (error) {
    console.error('[test-buyer-7294-status] Error:', error);
    return;
  }
  
  console.log('[test-buyer-7294-status] Buyer 7294 data:');
  console.log(JSON.stringify({
    buyer_number: data.buyer_number,
    three_calls_confirmed: data.three_calls_confirmed,
    inquiry_email_phone: data.inquiry_email_phone,
    inquiry_email_reply: data.inquiry_email_reply,
    next_call_date: data.next_call_date,
    follow_up_assignee: data.follow_up_assignee,
  }, null, 2));
  
  const statusResult = calculateBuyerStatus(data);
  
  console.log('[test-buyer-7294-status] Calculated status:');
  console.log(JSON.stringify(statusResult, null, 2));
  
  console.log('[test-buyer-7294-status] ===== END =====');
}

testBuyer7294Status();
