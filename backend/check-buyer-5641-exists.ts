import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyer5641() {
  console.log('🔍 Checking if buyer 5641 exists in database...\n');

  // 買主番号で検索
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '5641')
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'PGRST116') {
      console.log('\n⚠️ Buyer 5641 NOT FOUND in database');
    }
    return;
  }

  if (buyer) {
    console.log('✅ Buyer 5641 EXISTS in database');
    console.log('\nBuyer data:');
    console.log('  buyer_number:', buyer.buyer_number);
    console.log('  name:', buyer.name);
    console.log('  next_call_date:', buyer.next_call_date);
    console.log('  follow_up_assignee:', buyer.follow_up_assignee);
    console.log('  viewing_date:', buyer.viewing_date);
    console.log('  notification_sender:', buyer.notification_sender);
  } else {
    console.log('⚠️ Buyer 5641 NOT FOUND in database');
  }
}

checkBuyer5641().catch(console.error);
