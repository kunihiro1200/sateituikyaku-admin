import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function rebuildBuyerSidebarCounts() {
  console.log('🔄 買主サイドバーカウントを再構築します\n');

  // 今日の日付（YYYY-MM-DD形式）
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`📅 今日の日付: ${todayStr}\n`);

  // 全買主データを取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 全買主: ${buyers?.length ?? 0}件\n`);

  // カウントを初期化
  const counts: Record<string, number> = {};
  const assignedCounts: Record<string, number> = {}; // 担当(イニシャル)
  const todayCallAssignedCounts: Record<string, number> = {}; // 当日TEL(イニシャル)

  // 各買主のカテゴリーを判定
  let todayCallUCount = 0; // デバッグ用
  for (const buyer of buyers ?? []) {
    // 内覧日前日
    if (buyer.viewing_date && !buyer.broker_inquiry && !buyer.notification_sender) {
      const viewingDateStr = new Date(buyer.viewing_date).toISOString().split('T')[0];
      const viewingDate = new Date(viewingDateStr + 'T00:00:00Z');
      const viewingDay = viewingDate.getUTCDay();
      const daysBeforeViewing = viewingDay === 4 ? 2 : 1;
      const notifyDate = new Date(viewingDate);
      notifyDate.setUTCDate(notifyDate.getUTCDate() - daysBeforeViewing);
      const notifyDateStr = notifyDate.toISOString().split('T')[0];

      if (todayStr === notifyDateStr) {
        counts['viewingDayBefore'] = (counts['viewingDayBefore'] || 0) + 1;
      }
    }

    // 当日TEL（後続担当が空 + 次電日が今日以前）
    if (!buyer.follow_up_assignee && buyer.next_call_date) {
      const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
      if (nextCallDateStr <= todayStr) {
        counts['todayCall'] = (counts['todayCall'] || 0) + 1;
      }
    }

    // 担当(イニシャル)
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee;
    if (assignee) {
      assignedCounts[assignee] = (assignedCounts[assignee] || 0) + 1;

      // 当日TEL(イニシャル)（後続担当が空でない + 次電日が今日以前）
      // 🚨 重要: follow_up_assigneeを使用（initial_assigneeではない）
      if (buyer.follow_up_assignee && buyer.next_call_date) {
        const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
        if (nextCallDateStr <= todayStr) {
          // follow_up_assigneeを使用
          todayCallAssignedCounts[buyer.follow_up_assignee] = (todayCallAssignedCounts[buyer.follow_up_assignee] || 0) + 1;
          
          // デバッグ: 当日TEL(U)のカウント
          if (buyer.follow_up_assignee === 'U') {
            todayCallUCount++;
            console.log(`  [DEBUG] 当日TEL(U) ${todayCallUCount}件目: 買主${buyer.buyer_number}, next_call_date=${nextCallDateStr}`);
          }
        }
      }
    }
  }
  
  console.log(`\n[DEBUG] 当日TEL(U)の合計: ${todayCallUCount}件\n`);

  console.log('📊 計算されたカウント:');
  console.log('  内覧日前日:', counts['viewingDayBefore'] || 0);
  console.log('  当日TEL:', counts['todayCall'] || 0);
  console.log('  担当(イニシャル):', assignedCounts);
  console.log('  当日TEL(イニシャル):', todayCallAssignedCounts);
  console.log('');

  // buyer_sidebar_countsテーブルを全削除
  console.log('🗑️  既存のbuyer_sidebar_countsを削除...');
  const { error: deleteError } = await supabase
    .from('buyer_sidebar_counts')
    .delete()
    .neq('category', '___never___'); // 全件削除

  if (deleteError) {
    console.error('❌ 削除エラー:', deleteError);
    return;
  }
  console.log('✅ 削除完了\n');

  // 新しいカウントを挿入
  console.log('📝 新しいカウントを挿入...');
  const now = new Date().toISOString();
  const rows: any[] = [];

  // 内覧日前日
  if (counts['viewingDayBefore']) {
    rows.push({
      category: 'viewingDayBefore',
      count: counts['viewingDayBefore'],
      label: '',
      assignee: '',
      updated_at: now
    });
  }

  // 当日TEL
  if (counts['todayCall']) {
    rows.push({
      category: 'todayCall',
      count: counts['todayCall'],
      label: '',
      assignee: '',
      updated_at: now
    });
  }

  // 担当(イニシャル)
  for (const [assignee, count] of Object.entries(assignedCounts)) {
    rows.push({
      category: 'assigned',
      count,
      label: '',
      assignee,
      updated_at: now
    });
  }

  // 当日TEL(イニシャル)
  for (const [assignee, count] of Object.entries(todayCallAssignedCounts)) {
    rows.push({
      category: 'todayCallAssigned',
      count,
      label: '',
      assignee,
      updated_at: now
    });
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('buyer_sidebar_counts')
      .insert(rows);

    if (insertError) {
      console.error('❌ 挿入エラー:', insertError);
      return;
    }
    console.log(`✅ ${rows.length}件のカウントを挿入しました\n`);
  }

  // 結果を確認
  console.log('📊 buyer_sidebar_countsテーブルの内容:');
  const { data: result } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .order('category', { ascending: true })
    .order('assignee', { ascending: true });

  if (result) {
    for (const row of result) {
      console.log(`  - category: ${row.category}, assignee: ${row.assignee || '(空)'}, count: ${row.count}`);
    }
  }

  console.log('\n✅ 再構築完了！');
}

rebuildBuyerSidebarCounts().catch(console.error);
