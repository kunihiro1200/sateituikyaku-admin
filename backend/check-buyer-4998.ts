import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBuyer() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, next_call_date, follow_up_assignee, initial_assignee, latest_status')
    .eq('buyer_number', '4998')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('買主4998のデータ:');
  console.log('  buyer_number:', data.buyer_number);
  console.log('  next_call_date:', data.next_call_date);
  console.log('  follow_up_assignee:', data.follow_up_assignee);
  console.log('  initial_assignee:', data.initial_assignee);
  console.log('  latest_status:', data.latest_status);
  
  // 今日の日付
  const today = new Date().toISOString().split('T')[0];
  console.log('  今日:', today);
  
  // 「当日TEL」の条件チェック
  const isFollowUpEmpty = !data.follow_up_assignee || data.follow_up_assignee.trim() === '';
  const hasNextCallDate = data.next_call_date && data.next_call_date.trim() !== '';
  const isNextCallToday = data.next_call_date && data.next_call_date.substring(0, 10) <= today;
  
  console.log('\n条件チェック:');
  console.log('  follow_up_assigneeが空:', isFollowUpEmpty);
  console.log('  next_call_dateが空でない:', hasNextCallDate);
  console.log('  next_call_dateが今日以前:', isNextCallToday);
  console.log('  → 「当日TEL」に該当:', isFollowUpEmpty && hasNextCallDate && isNextCallToday);
}

checkBuyer().catch(console.error);
