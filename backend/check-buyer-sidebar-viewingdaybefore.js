const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkViewingDayBefore() {
  console.log('📊 buyer_sidebar_countsテーブルを確認...');
  
  const { data, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'viewingDayBefore');
  
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log('✅ viewingDayBeforeカテゴリ:', data);
  
  if (data.length === 0) {
    console.log('⚠️ viewingDayBeforeカテゴリが見つかりません');
  } else {
    console.log(`✅ カウント: ${data[0].count}件`);
  }
  
  // 全カテゴリを確認
  const { data: allData } = await supabase
    .from('buyer_sidebar_counts')
    .select('category, count')
    .order('category');
  
  console.log('\n📊 全カテゴリ:');
  allData.forEach(row => {
    console.log(`  ${row.category}: ${row.count}件`);
  });
}

checkViewingDayBefore();
