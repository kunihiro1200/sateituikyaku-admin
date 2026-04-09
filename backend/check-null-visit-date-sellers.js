const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkNullVisitDateSellers() {
  console.log('='.repeat(75));
  console.log('訪問日が空欄（null）の売主を確認');
  console.log('='.repeat(75));
  console.log('');
  
  // 訪問日が空欄の売主を取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('id, seller_number, visit_date, visit_assignee, visit_reminder_assignee')
    .is('deleted_at', null)
    .is('visit_date', null);
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log(`【結果】訪問日が空欄（null）の売主: ${sellers.length}件`);
  console.log('');
  
  if (sellers.length > 0) {
    console.log('【最初の10件を表示】');
    sellers.slice(0, 10).forEach((seller, i) => {
      console.log(`${i + 1}. ${seller.seller_number}`);
      console.log(`   訪問日: ${seller.visit_date}`);
      console.log(`   営担: ${seller.visit_assignee}`);
      console.log(`   訪問前日通知担当: ${seller.visit_reminder_assignee}`);
      console.log('');
    });
  }
  
  console.log('='.repeat(75));
  console.log('確認完了');
  console.log('='.repeat(75));
}

checkNullVisitDateSellers().catch(console.error);
