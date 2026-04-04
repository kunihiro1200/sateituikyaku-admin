import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkTodayCallAssigned() {
  console.log('🔍 買主の「当日TEL（担当別）」条件チェック\n');
  
  // 今日の日付（YYYY-MM-DD形式）
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 今日の日付: ${today}\n`);
  
  // 全買主データを取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, latest_status, next_call_date, follow_up_assignee, initial_assignee')
    .order('buyer_number', { ascending: true });
  
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log(`📊 全買主数: ${buyers?.length || 0}\n`);
  
  // 条件を満たす買主をカウント
  const todayCallAssignedCounts: Record<string, number> = {};
  const matchedBuyers: any[] = [];
  
  buyers?.forEach(buyer => {
    const status = buyer.latest_status || '';
    const nextCallDate = buyer.next_call_date ? buyer.next_call_date.split('T')[0] : null;
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee || '';
    const isAssigneeValid = assignee && assignee !== '外す';
    
    // 条件: 追客中 + 次電日が今日以前 + 担当あり
    const isMatch = 
      status.includes('追客中') &&
      nextCallDate &&
      nextCallDate <= today &&
      isAssigneeValid;
    
    if (isMatch) {
      todayCallAssignedCounts[assignee] = (todayCallAssignedCounts[assignee] || 0) + 1;
      matchedBuyers.push({
        buyer_number: buyer.buyer_number,
        latest_status: status,
        next_call_date: nextCallDate,
        assignee: assignee
      });
    }
  });
  
  console.log('✅ 条件を満たす買主（当日TEL担当別）:\n');
  console.log('カウント:', todayCallAssignedCounts);
  console.log('\n詳細:');
  matchedBuyers.forEach(b => {
    console.log(`  - ${b.buyer_number}: 担当=${b.assignee}, 次電日=${b.next_call_date}, 状況=${b.latest_status}`);
  });
  
  console.log(`\n📊 合計: ${matchedBuyers.length}件`);
  
  // buyer_sidebar_countsテーブルの内容を確認
  console.log('\n🔍 buyer_sidebar_countsテーブルの内容:\n');
  const { data: sidebarData, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCallAssigned')
    .order('assignee', { ascending: true });
  
  if (sidebarError) {
    console.error('❌ エラー:', sidebarError);
  } else if (!sidebarData || sidebarData.length === 0) {
    console.log('⚠️ todayCallAssignedカテゴリのデータが存在しません');
  } else {
    console.log('✅ todayCallAssignedカテゴリのデータ:');
    sidebarData.forEach(row => {
      console.log(`  - 担当=${row.assignee}, カウント=${row.count}, 更新日時=${row.updated_at}`);
    });
  }
}

checkTodayCallAssigned().catch(console.error);
