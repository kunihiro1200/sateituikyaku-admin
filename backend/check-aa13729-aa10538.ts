import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
    .in('seller_number', ['AA13729', 'AA10538']);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('=== AA13729とAA10538のデータ ===\n');
  data?.forEach(s => {
    console.log(`売主番号: ${s.seller_number}`);
    console.log(`  visit_date: ${s.visit_date}`);
    console.log(`  visit_assignee: ${s.visit_assignee}`);
    console.log(`  visit_reminder_assignee: ${s.visit_reminder_assignee}`);
    console.log('');
  });

  // 訪問日前日の判定
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  const todayJST = jstDate.toISOString().split('T')[0];
  console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

  data?.forEach(s => {
    console.log(`\n=== ${s.seller_number} の判定 ===`);
    
    // visit_reminder_assigneeチェック
    const reminderAssignee = s.visit_reminder_assignee || '';
    console.log(`visit_reminder_assignee: "${reminderAssignee}"`);
    if (reminderAssignee.trim() !== '') {
      console.log('❌ visit_reminder_assigneeに値があるため除外');
      return;
    }
    console.log('✅ visit_reminder_assigneeは空');

    // 訪問日チェック
    const vd = s.visit_date;
    if (!vd) {
      console.log('❌ visit_dateが空');
      return;
    }
    console.log(`visit_date: ${vd}`);

    // TIMESTAMP型対応: 日付部分のみを抽出
    const visitDateOnly = vd.split('T')[0].split(' ')[0];
    console.log(`visitDateOnly: ${visitDateOnly}`);
    
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) {
      console.log('❌ 日付フォーマットが不正');
      return;
    }

    const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dow = visitDate.getDay();
    console.log(`曜日: ${dow} (0=日, 1=月, ..., 6=土)`);
    
    const days = dow === 4 ? 2 : 1;
    console.log(`通知日: ${days}日前`);

    const notify = new Date(visitDate);
    notify.setDate(visitDate.getDate() - days);
    const notifyStr = `${notify.getFullYear()}-${String(notify.getMonth() + 1).padStart(2, '0')}-${String(notify.getDate()).padStart(2, '0')}`;
    console.log(`通知日: ${notifyStr}`);

    const match = notifyStr === todayJST;
    console.log(`今日と一致: ${match ? '✅ YES' : '❌ NO'}`);
  });
}

checkSellers().catch(console.error);
