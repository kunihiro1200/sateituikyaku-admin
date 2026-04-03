import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyerSidebarCounts() {
  console.log('📊 buyer_sidebar_counts テーブルを確認中...\n');

  // viewingDayBefore カテゴリのデータを取得
  const { data, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'viewingDayBefore')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  viewingDayBefore カテゴリのデータが見つかりません');
    console.log('   GASの testBuyerSync を実行してください');
    return;
  }

  console.log('✅ viewingDayBefore カテゴリのデータが見つかりました:\n');
  console.log('category          | count | label | assignee | updated_at');
  console.log('------------------|-------|-------|----------|-------------------');
  
  data.forEach(row => {
    const category = row.category.padEnd(17);
    const count = String(row.count).padEnd(5);
    const label = (row.label || '').padEnd(5);
    const assignee = (row.assignee || '').padEnd(8);
    const updatedAt = new Date(row.updated_at).toLocaleString('ja-JP');
    console.log(`${category} | ${count} | ${label} | ${assignee} | ${updatedAt}`);
  });

  console.log('\n✅ データベース確認完了');
}

checkBuyerSidebarCounts().catch(console.error);
