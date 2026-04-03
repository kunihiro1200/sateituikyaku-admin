// GAS実行後のサイドバーカウントを確認
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSidebarCounts() {
  console.log('=== GAS実行後のサイドバーカウント確認 ===\n');
  
  // 1. visitDayBeforeカテゴリのカウントを確認
  const { data: visitDayBefore, error: error1 } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'visitDayBefore')
    .single();
  
  if (error1) {
    console.log('❌ visitDayBeforeカテゴリが見つかりません:', error1.message);
  } else {
    console.log('📊 visitDayBeforeカテゴリ:');
    console.log('  カウント:', visitDayBefore.count);
    console.log('  更新日時:', visitDayBefore.updated_at);
    console.log('');
  }
  
  // 2. 全カテゴリのカウントを確認
  const { data: allCounts, error: error2 } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .order('category');
  
  if (error2) {
    console.log('❌ エラー:', error2.message);
    return;
  }
  
  console.log('📊 全カテゴリのカウント:');
  allCounts.forEach(row => {
    if (row.count > 0) {
      console.log(`  ${row.category}: ${row.count}件`);
    }
  });
  console.log('');
  
  // 3. AA13729の現在の状態を確認
  const { data: seller, error: error3 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, visit_date')
    .eq('seller_number', 'AA13729')
    .single();
  
  if (error3) {
    console.log('❌ AA13729が見つかりません:', error3.message);
    return;
  }
  
  console.log('📊 AA13729の現在の状態:');
  console.log('  売主番号:', seller.seller_number);
  console.log('  営担:', seller.visit_assignee);
  console.log('  訪問日:', seller.visit_date);
  console.log('');
  
  // 4. 判定ロジックをシミュレート
  const visitAssignee = seller.visit_assignee;
  const isVisitAssigneeValid = visitAssignee && visitAssignee !== '';
  
  console.log('✅ 営担チェック:', isVisitAssigneeValid ? 'OK' : 'NG');
  
  if (!isVisitAssigneeValid) {
    console.log('❌ 営担が空のため、訪問日前日カテゴリに含まれません');
    return;
  }
  
  // 訪問日を日付部分のみに変換
  let visitDateStr = seller.visit_date;
  if (visitDateStr) {
    visitDateStr = visitDateStr.split('T')[0].split(' ')[0];
    console.log('📅 訪問日（日付部分のみ）:', visitDateStr);
  }
  
  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log('📅 今日:', today.toISOString().split('T')[0]);
  
  // 訪問日前日判定
  const visitDate = new Date(visitDateStr);
  visitDate.setHours(0, 0, 0, 0);
  const visitDay = visitDate.getDay();
  const daysBeforeVisit = (visitDay === 4) ? 2 : 1;
  const notifyDate = new Date(visitDate);
  notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
  
  console.log('📅 訪問日の曜日:', ['日','月','火','水','木','金','土'][visitDay]);
  console.log('📅 通知日（訪問日の' + daysBeforeVisit + '日前）:', notifyDate.toISOString().split('T')[0]);
  console.log('📅 今日 === 通知日:', today.getTime() === notifyDate.getTime() ? '✅ 一致' : '❌ 不一致');
  console.log('');
  
  if (today.getTime() === notifyDate.getTime()) {
    console.log('✅ AA13729は訪問日前日カテゴリに含まれるはず');
    console.log('');
    console.log('⚠️ しかし、サイドバーカウントが0の場合、GASのロジックに問題がある可能性があります');
  } else {
    console.log('❌ AA13729は訪問日前日カテゴリに含まれない');
    console.log('   今日:', today.toISOString().split('T')[0]);
    console.log('   通知日:', notifyDate.toISOString().split('T')[0]);
  }
}

checkSidebarCounts().then(() => process.exit(0));
