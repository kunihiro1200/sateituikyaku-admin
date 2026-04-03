const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://krxhrbtlgfjzsseegaqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
);

async function checkSidebarCounts() {
  console.log('=== seller_sidebar_counts テーブル確認 ===\n');
  
  // visitDayBeforeカテゴリを確認
  const { data: visitDayBefore, error: vdbError } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'visitDayBefore')
    .single();
  
  if (vdbError) {
    console.log('❌ visitDayBeforeカテゴリ取得エラー:', vdbError.message);
  } else {
    console.log('✅ visitDayBeforeカテゴリ:');
    console.log('   カウント:', visitDayBefore.count);
    console.log('   更新日時:', visitDayBefore.updated_at);
  }
  
  console.log('\n=== AA13729の訪問日情報確認 ===\n');
  
  // AA13729の訪問日を確認
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, visit_date, status')
    .eq('seller_number', 'AA13729')
    .single();
  
  if (sellerError) {
    console.log('❌ AA13729取得エラー:', sellerError.message);
  } else {
    console.log('✅ AA13729:');
    console.log('   営担:', seller.visit_assignee);
    console.log('   訪問日:', seller.visit_date);
    console.log('   状況:', seller.status);
    
    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('\n   今日:', today.toISOString().split('T')[0]);
    
    // 訪問日
    const visitDate = new Date(seller.visit_date);
    visitDate.setHours(0, 0, 0, 0);
    console.log('   訪問日（Date）:', visitDate.toISOString().split('T')[0]);
    console.log('   訪問日の曜日:', ['日', '月', '火', '水', '木', '金', '土'][visitDate.getDay()]);
    
    // 前営業日の計算
    const visitDay = visitDate.getDay();
    const daysBeforeVisit = (visitDay === 4) ? 2 : 1; // 木曜訪問のみ2日前
    const notifyDate = new Date(visitDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
    console.log('   前営業日:', notifyDate.toISOString().split('T')[0]);
    console.log('   前営業日の曜日:', ['日', '月', '火', '水', '木', '金', '土'][notifyDate.getDay()]);
    
    // 判定
    const isVisitDayBefore = today.getTime() === notifyDate.getTime();
    console.log('\n   今日 === 前営業日?', isVisitDayBefore ? '✅ YES' : '❌ NO');
  }
  
  console.log('\n=== 全カテゴリ一覧 ===\n');
  
  // 全カテゴリを確認
  const { data: allCategories, error: allError } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .order('category');
  
  if (allError) {
    console.log('❌ 全カテゴリ取得エラー:', allError.message);
  } else {
    allCategories.forEach(cat => {
      console.log(`${cat.category}: ${cat.count}件 (assignee: ${cat.assignee || 'null'}, label: ${cat.label || 'null'})`);
    });
  }
}

checkSidebarCounts().catch(console.error);
