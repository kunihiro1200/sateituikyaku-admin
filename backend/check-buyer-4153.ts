import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // 買主4153のデータを確認
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', 4153)
    .single();
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log('買主4153のデータ:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  next_call_date:', buyer.next_call_date);
  console.log('  follow_up_assignee:', buyer.follow_up_assignee);
  console.log('  viewing_date:', buyer.viewing_date);
  console.log('  notification_sender:', buyer.notification_sender);
  
  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  console.log('  今日:', todayStr);
  
  // 当日TELの条件を確認
  const isFollowUpEmpty = !buyer.follow_up_assignee;
  const hasNextCallDate = !!buyer.next_call_date;
  const nextCallDate = buyer.next_call_date ? new Date(buyer.next_call_date) : null;
  const isTodayOrBefore = nextCallDate ? nextCallDate.toISOString().split('T')[0] <= todayStr : false;
  
  console.log('\n当日TELの条件:');
  console.log('  follow_up_assigneeが空:', isFollowUpEmpty);
  console.log('  next_call_dateがある:', hasNextCallDate);
  console.log('  next_call_dateが今日以前:', isTodayOrBefore);
  console.log('  → 当日TELに該当:', isFollowUpEmpty && hasNextCallDate && isTodayOrBefore);
  
  // buyer_sidebar_countsテーブルを確認
  console.log('\nbuyer_sidebar_countsテーブル:');
  const { data: counts } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall');
  
  console.log('  todayCallカウント:', counts);
}

check().catch(console.error);
