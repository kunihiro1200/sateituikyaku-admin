/**
 * seller_sidebar_countsテーブルの最終更新時刻を確認
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSidebarCounts() {
  console.log('='.repeat(60));
  console.log('seller_sidebar_counts テーブルの最終更新時刻確認');
  console.log('='.repeat(60));

  // visitDayBeforeカテゴリの最終更新時刻を確認
  const { data: visitDayBefore, error: error1 } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'visitDayBefore')
    .single();

  if (error1) {
    console.log('\n❌ visitDayBeforeカテゴリが見つかりません:', error1.message);
  } else {
    console.log(`\nカテゴリ: ${visitDayBefore.category}`);
    console.log(`カウント: ${visitDayBefore.count}`);
    console.log(`最終更新: ${visitDayBefore.updated_at}`);
  }

  // 全カテゴリの最終更新時刻を確認
  console.log('\n' + '='.repeat(60));
  console.log('全カテゴリの最終更新時刻（最新10件）');
  console.log('='.repeat(60));

  const { data: allCategories, error: error2 } = await supabase
    .from('seller_sidebar_counts')
    .select('category, count, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error2) {
    console.log('\n❌ データ取得エラー:', error2.message);
  } else {
    allCategories.forEach(row => {
      console.log(`${row.category.padEnd(30)} | カウント: ${String(row.count).padStart(3)} | 更新: ${row.updated_at}`);
    });
  }

  // 現在時刻との比較
  console.log('\n' + '='.repeat(60));
  console.log('現在時刻との比較');
  console.log('='.repeat(60));

  const now = new Date();
  console.log(`現在時刻（UTC）: ${now.toISOString()}`);

  if (allCategories && allCategories.length > 0) {
    const latest = allCategories[0];
    const latestTime = new Date(latest.updated_at);
    const diffMinutes = (now - latestTime) / 1000 / 60;
    console.log(`最終更新からの経過時間: ${diffMinutes.toFixed(1)}分`);
    
    if (diffMinutes > 15) {
      console.log('\n⚠️  警告: 最終更新から15分以上経過しています');
      console.log('   GASの同期が正常に動作していない可能性があります');
    } else {
      console.log('\n✅ 最終更新は15分以内です（正常）');
    }
  }
}

checkSidebarCounts().catch(console.error);
