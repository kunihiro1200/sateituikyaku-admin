const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function investigate() {
  console.log('=== seller_sidebar_counts テーブル調査 ===\n');
  
  // 1. visitDayBeforeカテゴリーのレコードを確認
  const { data: records, error } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'visitDayBefore');
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('visitDayBeforeカテゴリーのレコード数:', records.length);
  console.log('レコード詳細:');
  records.forEach((r, i) => {
    console.log(`  ${i+1}. 全フィールド:`, JSON.stringify(r, null, 2));
  });
  
  // 2. AA13888の訪問日を確認
  console.log('\n=== AA13888の訪問日確認 ===\n');
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
    .eq('seller_number', 'AA13888')
    .single();
  
  if (sellerError) {
    console.error('エラー:', sellerError);
  } else {
    console.log('AA13888:');
    console.log('  訪問日:', seller.visit_date || 'null');
    console.log('  営担:', seller.visit_assignee || 'null');
    console.log('  訪問前日通知担当:', seller.visit_reminder_assignee || 'null');
  }
}

investigate().catch(console.error);
