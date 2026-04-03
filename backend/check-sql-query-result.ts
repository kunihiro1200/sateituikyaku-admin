import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSQLQuery() {
  console.log('=== バックエンドのSQLクエリを実行 ===\n');

  // バックエンドと同じクエリを実行
  const { data: visitAssigneeSellers, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    // 「外す」は有効な営業担当として扱う
    .not('visit_date', 'is', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 取得した売主数: ${visitAssigneeSellers?.length ?? 0}\n`);

  // AA13729とAA10538を検索
  const aa13729 = visitAssigneeSellers?.find(s => s.seller_number === 'AA13729');
  const aa10538 = visitAssigneeSellers?.find(s => s.seller_number === 'AA10538');

  console.log('=== AA13729 ===');
  if (aa13729) {
    console.log('✅ クエリ結果に含まれている');
    console.log(JSON.stringify(aa13729, null, 2));
  } else {
    console.log('❌ クエリ結果に含まれていない');
  }

  console.log('\n=== AA10538 ===');
  if (aa10538) {
    console.log('✅ クエリ結果に含まれている');
    console.log(JSON.stringify(aa10538, null, 2));
  } else {
    console.log('❌ クエリ結果に含まれていない');
  }

  // 訪問日前日の判定
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  const todayJST = jstDate.toISOString().split('T')[0];
  console.log(`\n📅 今日の日付（JST）: ${todayJST}\n`);

  const visitDayBeforeCount = (visitAssigneeSellers || []).filter(s => {
    const visitDateStr = s.visit_date;
    if (!visitDateStr) return false;
    const reminderAssignee = (s as any).visit_reminder_assignee || '';
    if (reminderAssignee.trim() !== '') return false;
    
    // TIMESTAMP型対応: 日付部分のみを抽出
    const visitDateOnly = visitDateStr.split('T')[0].split(' ')[0];
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) return false;
    const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const visitDayOfWeek = visitDate.getDay();
    const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
    const expectedNotifyDate = new Date(visitDate);
    expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
    const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
    
    const match = expectedNotifyStr === todayJST;
    if (match) {
      console.log(`✅ ${s.seller_number}: 訪問日前日に該当`);
    }
    return match;
  }).length;

  console.log(`\n📊 訪問日前日カウント: ${visitDayBeforeCount}`);
}

checkSQLQuery().catch(console.error);
