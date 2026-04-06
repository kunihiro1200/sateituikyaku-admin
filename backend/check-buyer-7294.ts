import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyer7294() {
  console.log('[check-buyer-7294] ===== START =====');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, three_calls_confirmed, inquiry_email_phone, inquiry_email_reply, next_call_date, follow_up_assignee')
    .eq('buyer_number', 7294)
    .single();
  
  if (error) {
    console.error('[check-buyer-7294] Error:', error);
    return;
  }
  
  console.log('[check-buyer-7294] Buyer 7294:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('[check-buyer-7294] ===== END =====');
}

checkBuyer7294();
