import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkVisitDayBeforeCounts() {
  console.log('=== 訪問日前日カウント確認 ===\n');

  // 1. GASが計算したカウントを確認
  const { data: sidebarCounts, error: sidebarError } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'visitDayBefore')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (sidebarError) {
    console.error('❌ seller_sidebar_counts取得エラー:', sidebarError);
    return;
  }

  console.log('📊 GASが計算したカウント:');
  console.log(JSON.stringify(sidebarCounts, null, 2));
  console.log('');

  // 2. 今日の日付を取得（JST）
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  const todayJST = jstDate.toISOString().split('T')[0];
  console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

  // 3. 訪問日前日の候補を取得
  const { data: candidates, error: candidatesError } = await supabase
    .from('sellers')
    .select('id, seller_number, visit_date, visit_assignee, visit_reminder_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .not('visit_date', 'is', null);

  if (candidatesError) {
    console.error('❌ 候補取得エラー:', candidatesError);
    return;
  }

  console.log(`📋 候補数: ${candidates?.length ?? 0}\n`);

  // 4. 訪問日前日に該当する売主を計算
  const visitDayBeforeSellers = (candidates || []).filter((s: any) => {
    // visitReminderAssigneeに値がある場合は除外
    const reminderAssignee = s.visit_reminder_assignee || '';
    if (reminderAssignee.trim() !== '') {
      console.log(`❌ ${s.seller_number}: visit_reminder_assignee=${reminderAssignee} (除外)`);
      return false;
    }

    const vd = s.visit_date;
    if (!vd) return false;

    // TIMESTAMP型対応: 日付部分のみを抽出
    const visitDateOnly = vd.split('T')[0].split(' ')[0];
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) return false;

    const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dow = visitDate.getDay();
    const days = dow === 4 ? 2 : 1; // 木曜訪問→2日前、それ以外→1日前

    const notify = new Date(visitDate);
    notify.setDate(visitDate.getDate() - days);
    const notifyStr = `${notify.getFullYear()}-${String(notify.getMonth() + 1).padStart(2, '0')}-${String(notify.getDate()).padStart(2, '0')}`;

    const match = notifyStr === todayJST;
    if (match) {
      console.log(`✅ ${s.seller_number}: visit_date=${vd}, dow=${dow}, notifyStr=${notifyStr}`);
    }
    return match;
  });

  console.log(`\n📊 訪問日前日に該当する売主数: ${visitDayBeforeSellers.length}`);
  console.log('売主番号:', visitDayBeforeSellers.map((s: any) => s.seller_number).join(', '));
}

checkVisitDayBeforeCounts().catch(console.error);
