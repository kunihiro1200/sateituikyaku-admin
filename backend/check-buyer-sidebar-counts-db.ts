import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyerSidebarCounts() {
  console.log('📊 buyer_sidebar_counts テーブルを確認...\n');

  const { data, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ 全${data.length}件\n`);

  // viewingDayBeforeカテゴリを探す
  const viewingDayBefore = data.filter(row => row.category === 'viewingDayBefore');
  
  if (viewingDayBefore.length === 0) {
    console.log('❌ viewingDayBeforeカテゴリが見つかりません');
  } else {
    console.log('✅ viewingDayBeforeカテゴリ:');
    viewingDayBefore.forEach(row => {
      console.log(`  - count: ${row.count}, label: "${row.label}", assignee: "${row.assignee}"`);
    });
  }

  console.log('\n📋 全カテゴリ:');
  const categoryGroups = data.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {} as Record<string, any[]>);

  Object.keys(categoryGroups).sort().forEach(category => {
    const rows = categoryGroups[category];
    const totalCount = rows.reduce((sum, r) => sum + (r.count || 0), 0);
    console.log(`  ${category}: ${totalCount}件`);
  });
}

checkBuyerSidebarCounts().catch(console.error);
