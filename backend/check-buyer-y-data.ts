import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBuyerYData() {
  console.log('=== 買主データ確認 (follow_up_assignee = Y) ===\n');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, follow_up_assignee, initial_assignee, latest_status, next_call_date, viewing_date')
    .eq('follow_up_assignee', 'Y')
    .order('buyer_number', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`見つかった買主: ${data?.length}件\n`);
  
  data?.forEach(b => {
    console.log(`買主番号: ${b.buyer_number}`);
    console.log(`  follow_up_assignee: ${b.follow_up_assignee}`);
    console.log(`  initial_assignee: ${b.initial_assignee}`);
    console.log(`  latest_status: ${b.latest_status}`);
    console.log(`  next_call_date: ${b.next_call_date}`);
    console.log(`  viewing_date: ${b.viewing_date}`);
    console.log('');
  });
}

checkBuyerYData().catch(console.error);
