import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testPaginationFix() {
  console.log('=== ページネーション修正後のテスト ===\n');

  // 今日の日付を取得（JST）
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  const todayJST = jstDate.toISOString().split('T')[0];
  console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

  // ページネーション処理で全件取得
  let visitAssigneeSellers: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  console.log('📄 ページネーション処理開始...\n');
  
  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .not('visit_date', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('❌ エラー:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    visitAssigneeSellers = visitAssigneeSellers.concat(data);
    console.log(`  ページ ${page + 1}: ${data.length}件取得（累計: ${visitAssigneeSellers.length}件）`);
    
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n📊 取得した売主数（全件）: ${visitAssigneeSellers.length}\n`);

  // 訪問日前日の判定
  const visitDayBeforeCount = visitAssigneeSellers.filter(s => {
    const visitDateStr = s.visit_date;
    if (!visitDateStr) return false;
    const reminderAssignee = s.visit_reminder_assignee || '';
    if (reminderAssignee.trim() !== '') return false;
    
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
  console.log('\n✅ 期待値: 2件（AA13729, AA10538）');
  console.log(`✅ 実際の値: ${visitDayBeforeCount}件`);
  console.log(`\n${visitDayBeforeCount === 2 ? '✅ テスト成功！' : '❌ テスト失敗'}`);
}

testPaginationFix().catch(console.error);
