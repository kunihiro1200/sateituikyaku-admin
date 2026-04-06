import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyer7294Hex() {
  console.log('[check-buyer-7294-hex] ===== START =====');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, three_calls_confirmed, inquiry_email_phone')
    .eq('buyer_number', 7294)
    .single();
  
  if (error) {
    console.error('[check-buyer-7294-hex] Error:', error);
    return;
  }
  
  console.log('[check-buyer-7294-hex] Buyer 7294:');
  console.log('  buyer_number:', data.buyer_number);
  console.log('  three_calls_confirmed:', data.three_calls_confirmed);
  console.log('  three_calls_confirmed (hex):', Buffer.from(data.three_calls_confirmed || '', 'utf8').toString('hex'));
  console.log('  inquiry_email_phone:', data.inquiry_email_phone);
  console.log('  inquiry_email_phone (hex):', Buffer.from(data.inquiry_email_phone || '', 'utf8').toString('hex'));
  
  // 期待される値の16進数
  console.log('[check-buyer-7294-hex] Expected values:');
  console.log('  "3回架電未" (hex):', Buffer.from('3回架電未', 'utf8').toString('hex'));
  console.log('  "不通" (hex):', Buffer.from('不通', 'utf8').toString('hex'));
  
  console.log('[check-buyer-7294-hex] ===== END =====');
}

checkBuyer7294Hex();
