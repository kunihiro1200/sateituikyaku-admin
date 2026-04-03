// AA13729のGASロジックをシミュレートして、訪問日前日判定を確認
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GASのisVisitDayBefore関数をJavaScriptで再現
function isVisitDayBefore(visitDateStr) {
  if (!visitDateStr) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const visitDate = new Date(visitDateStr);
  visitDate.setHours(0, 0, 0, 0);
  
  const visitDay = visitDate.getDay();
  const daysBeforeVisit = (visitDay === 4) ? 2 : 1;
  
  const notifyDate = new Date(visitDate);
  notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
  
  console.log('📅 今日:', today.toISOString().split('T')[0]);
  console.log('📅 訪問日:', visitDate.toISOString().split('T')[0]);
  console.log('📅 訪問日の曜日:', ['日', '月', '火', '水', '木', '金', '土'][visitDay]);
  console.log('📅 通知日（訪問日の' + daysBeforeVisit + '日前）:', notifyDate.toISOString().split('T')[0]);
  console.log('📅 今日 === 通知日:', today.getTime() === notifyDate.getTime());
  
  return today.getTime() === notifyDate.getTime();
}

async function checkAA13729() {
  console.log('=== AA13729のGASロジック確認 ===\n');
  
  // 1. データベースから取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, visit_date')
    .eq('seller_number', 'AA13729')
    .single();
  
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log('📊 データベースの値:');
  console.log('  売主番号:', seller.seller_number);
  console.log('  営担:', seller.visit_assignee);
  console.log('  訪問日:', seller.visit_date);
  console.log('');
  
  // 2. GASロジックをシミュレート
  const visitAssignee = seller.visit_assignee;
  const isVisitAssigneeValid = visitAssignee && visitAssignee !== '';
  
  console.log('✅ 営担チェック:', isVisitAssigneeValid ? 'OK' : 'NG');
  
  if (!isVisitAssigneeValid) {
    console.log('❌ 営担が空のため、訪問日前日カテゴリに含まれません');
    return;
  }
  
  // 3. 訪問日をYYYY-MM-DD形式に変換（TIMESTAMP形式の場合、日付部分のみを抽出）
  let visitDateStr = seller.visit_date;
  if (visitDateStr) {
    // ISO 8601形式（YYYY-MM-DDTHH:MM:SS）またはスペース区切り（YYYY-MM-DD HH:MM:SS）に対応
    visitDateStr = visitDateStr.split('T')[0].split(' ')[0];
    console.log('📅 訪問日（日付部分のみ）:', visitDateStr);
  }
  
  console.log('');
  
  // 4. isVisitDayBefore関数を実行
  const result = isVisitDayBefore(visitDateStr);
  
  console.log('');
  console.log('🎯 結果:', result ? '✅ 訪問日前日カテゴリに含まれる' : '❌ 訪問日前日カテゴリに含まれない');
}

checkAA13729().then(() => process.exit(0));
