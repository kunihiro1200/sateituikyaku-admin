import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkAllCategories() {
  console.log('📊 buyer_sidebar_counts テーブルの全カテゴリを確認...\n');

  const { data, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .order('category', { ascending: true })
    .order('assignee', { ascending: true });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ 合計レコード数: ${data.length}\n`);

  // カテゴリ別にグループ化
  const byCategory: Record<string, any[]> = {};
  for (const row of data) {
    if (!byCategory[row.category]) {
      byCategory[row.category] = [];
    }
    byCategory[row.category].push(row);
  }

  // カテゴリごとに表示
  for (const [category, rows] of Object.entries(byCategory)) {
    console.log(`\n📂 ${category} (${rows.length}件):`);
    for (const row of rows) {
      const label = row.label || '(空)';
      const assignee = row.assignee || '(空)';
      console.log(`  - count=${row.count}, label=${label}, assignee=${assignee}`);
    }
  }

  // 期待されるカテゴリのチェック
  const expectedCategories = [
    'viewingDayBefore',
    'todayCall',
    'inquiryEmailNotResponded',
    'visitCompleted',
    'unvaluated',
    'mailingPending',
    'todayCallNotStarted',
    'pinrichEmpty',
    'exclusive',
    'general',
    'visitOtherDecision',
    'unvisitedOtherDecision',
    'todayCallAssigned',
    'todayCallWithInfo',
    'assigned'
  ];

  console.log('\n\n🔍 期待されるカテゴリのチェック:');
  for (const cat of expectedCategories) {
    const exists = byCategory[cat] ? '✅' : '❌';
    const count = byCategory[cat]?.length || 0;
    console.log(`${exists} ${cat}: ${count}件`);
  }
}

checkAllCategories().catch(console.error);
