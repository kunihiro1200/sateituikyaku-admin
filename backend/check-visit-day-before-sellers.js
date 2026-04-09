const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 今日の日付（JST）
function getTodayJST() {
  const now = new Date();
  const jstOffset = 9 * 60; // JST is UTC+9
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
}

// 訪問日前日判定（木曜訪問のみ2日前、それ以外は1日前）
function isVisitDayBefore(visitDateStr, todayStr) {
  if (!visitDateStr) return false;
  
  // TIMESTAMP形式（YYYY-MM-DD HH:MM:SS）から日付部分のみを抽出
  let visitDateOnly = visitDateStr;
  if (typeof visitDateStr === 'string') {
    if (visitDateStr.includes(' ')) {
      visitDateOnly = visitDateStr.split(' ')[0];
    } else if (visitDateStr.includes('T')) {
      visitDateOnly = visitDateStr.split('T')[0];
    }
  }
  
  const parts = visitDateOnly.split('-');
  if (parts.length !== 3) return false;
  
  const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const todayParts = todayStr.split('-');
  const today = new Date(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2]));
  
  const visitDayOfWeek = visitDate.getDay();
  const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1; // 木曜訪問のみ2日前
  
  const expectedNotifyDate = new Date(visitDate);
  expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
  
  const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
  
  return expectedNotifyStr === todayStr;
}

async function checkSellers() {
  console.log('=== 訪問日前日の売主を確認 ===\n');
  
  const todayJST = getTodayJST();
  console.log('今日（JST）:', todayJST);
  console.log('');
  
  // 営担があり、訪問日がある売主を取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .not('visit_date', 'is', null);
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log(`営担あり + 訪問日ありの売主: ${sellers.length}件\n`);
  
  // 訪問日前日の条件を満たす売主をフィルタリング
  const visitDayBeforeSellers = sellers.filter(s => {
    // visit_reminder_assigneeが空であることを確認
    if (s.visit_reminder_assignee && s.visit_reminder_assignee.trim() !== '') {
      return false;
    }
    
    // 訪問日前日判定
    return isVisitDayBefore(s.visit_date, todayJST);
  });
  
  console.log(`訪問日前日の条件を満たす売主: ${visitDayBeforeSellers.length}件\n`);
  
  visitDayBeforeSellers.forEach((s, i) => {
    console.log(`${i+1}. ${s.seller_number}`);
    console.log(`   訪問日: ${s.visit_date}`);
    console.log(`   営担: ${s.visit_assignee}`);
    console.log(`   訪問前日通知担当: ${s.visit_reminder_assignee || 'null'}`);
    console.log('');
  });
  
  // seller_sidebar_countsのカウントと比較
  const { data: countRecord } = await supabase
    .from('seller_sidebar_counts')
    .select('count')
    .eq('category', 'visitDayBefore')
    .single();
  
  console.log('=== カウント比較 ===');
  console.log(`seller_sidebar_counts: ${countRecord?.count || 0}件`);
  console.log(`実際の条件を満たす売主: ${visitDayBeforeSellers.length}件`);
  console.log(`差分: ${(countRecord?.count || 0) - visitDayBeforeSellers.length}件`);
}

checkSellers().catch(console.error);
