import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTodayCallUMismatch() {
  console.log('🔍 買主リスト「当日TEL(U)」カウント不一致調査\n');

  // 今日の日付（YYYY-MM-DD形式）
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`📅 今日の日付: ${todayStr}\n`);

  // サイドバーカウントを確認
  const { data: sidebarCounts } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCallAssigned')
    .eq('assignee', 'U');

  console.log('📊 サイドバーカウント（buyer_sidebar_counts）:');
  if (sidebarCounts && sidebarCounts.length > 0) {
    sidebarCounts.forEach(row => {
      console.log(`  - category: ${row.category}, assignee: ${row.assignee}, count: ${row.count}`);
    });
  } else {
    console.log('  - データなし');
  }
  console.log('');

  // 実際の買主データを確認（当日TEL(U)の条件）
  // 条件: follow_up_assignee = 'U' AND next_call_date <= 今日
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, follow_up_assignee, initial_assignee, next_call_date, latest_status')
    .or('follow_up_assignee.eq.U,initial_assignee.eq.U');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 担当がUの買主: ${buyers?.length ?? 0}件\n`);

  // 当日TEL(U)の条件を満たす買主をフィルタリング
  const todayCallU = buyers?.filter(buyer => {
    // follow_up_assigneeが空でない
    const hasFollowUpAssignee = buyer.follow_up_assignee && buyer.follow_up_assignee !== '';
    
    // follow_up_assigneeがU
    const isU = buyer.follow_up_assignee === 'U';
    
    // next_call_dateが空でない
    const hasNextCallDate = buyer.next_call_date && buyer.next_call_date !== '';
    
    // next_call_dateが今日以前
    let isNextCallDateTodayOrBefore = false;
    if (hasNextCallDate) {
      const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
      isNextCallDateTodayOrBefore = nextCallDateStr <= todayStr;
    }
    
    return hasFollowUpAssignee && isU && hasNextCallDate && isNextCallDateTodayOrBefore;
  }) ?? [];

  console.log(`📊 当日TEL(U)の条件を満たす買主: ${todayCallU.length}件\n`);

  if (todayCallU.length > 0) {
    console.log('📋 当日TEL(U)の買主一覧:');
    todayCallU.forEach(buyer => {
      const nextCallDateStr = buyer.next_call_date 
        ? new Date(buyer.next_call_date).toISOString().split('T')[0]
        : 'なし';
      console.log(`  - ${buyer.buyer_number}: ${buyer.name}`);
      console.log(`    後続担当: ${buyer.follow_up_assignee}, 初動担当: ${buyer.initial_assignee}`);
      console.log(`    次電日: ${nextCallDateStr}, 最新状況: ${buyer.latest_status}`);
    });
  }

  console.log('\n🔍 不一致の原因:');
  const sidebarCount = sidebarCounts?.[0]?.count ?? 0;
  const actualCount = todayCallU.length;
  
  if (sidebarCount !== actualCount) {
    console.log(`  ❌ サイドバーカウント（${sidebarCount}件）と実際の件数（${actualCount}件）が一致しません`);
    console.log(`  📝 差分: ${actualCount - sidebarCount}件`);
  } else {
    console.log(`  ✅ サイドバーカウント（${sidebarCount}件）と実際の件数（${actualCount}件）が一致しています`);
  }
}

checkTodayCallUMismatch().catch(console.error);
