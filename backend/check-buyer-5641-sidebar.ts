import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBuyer5641() {
  console.log('=== 買主5641のサイドバーカテゴリー判定 ===\n');

  // 買主データを取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '5641')
    .single();

  if (error || !buyer) {
    console.error('❌ 買主5641が見つかりません:', error);
    return;
  }

  console.log('📊 買主5641のデータ:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  follow_up_assignee:', buyer.follow_up_assignee);
  console.log('  initial_assignee:', buyer.initial_assignee);
  console.log('  next_call_date:', buyer.next_call_date);
  console.log('  viewing_date:', buyer.viewing_date);
  console.log('  broker_inquiry:', buyer.broker_inquiry);
  console.log('  notification_sender:', buyer.notification_sender);
  console.log('');

  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log('📅 今日の日付:', today.toISOString().split('T')[0]);
  console.log('');

  // 当日TELの条件チェック
  console.log('🔍 当日TELの条件チェック:');
  console.log('  条件1: follow_up_assigneeが空 →', !buyer.follow_up_assignee ? '✅' : '❌ (' + buyer.follow_up_assignee + ')');
  console.log('  条件2: next_call_dateが空でない →', buyer.next_call_date ? '✅' : '❌');
  
  if (buyer.next_call_date) {
    const nextCallDate = new Date(buyer.next_call_date);
    nextCallDate.setHours(0, 0, 0, 0);
    console.log('  条件3: next_call_dateが今日以前 →', nextCallDate.getTime() <= today.getTime() ? '✅' : '❌');
    console.log('    next_call_date:', nextCallDate.toISOString().split('T')[0]);
    console.log('    today:', today.toISOString().split('T')[0]);
    console.log('    比較結果:', nextCallDate.getTime(), '<=', today.getTime(), '=', nextCallDate.getTime() <= today.getTime());
  }
  console.log('');

  // 結論
  const isFollowUpAssigneeEmpty = !buyer.follow_up_assignee;
  const hasNextCallDate = !!buyer.next_call_date;
  const nextCallDate = buyer.next_call_date ? new Date(buyer.next_call_date) : null;
  if (nextCallDate) {
    nextCallDate.setHours(0, 0, 0, 0);
  }
  const isNextCallDateTodayOrBefore = nextCallDate ? nextCallDate.getTime() <= today.getTime() : false;

  const isTodayCall = isFollowUpAssigneeEmpty && hasNextCallDate && isNextCallDateTodayOrBefore;

  console.log('📊 結論:');
  console.log('  当日TELに該当:', isTodayCall ? '✅ YES' : '❌ NO');
  console.log('');

  // サイドバーカウントテーブルを確認
  console.log('🔍 buyer_sidebar_countsテーブルを確認:');
  const { data: counts, error: countsError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall');

  if (countsError) {
    console.error('❌ エラー:', countsError);
  } else {
    console.log('  todayCallカテゴリーのカウント:', counts);
  }
}

checkBuyer5641().catch(console.error);
