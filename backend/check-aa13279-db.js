require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // AA13279のデータを取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, visit_date, status, updated_at')
    .eq('seller_number', 'AA13279')
    .single();

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log('=== AA13279のDBデータ ===');
  console.log('売主番号:', seller.seller_number);
  console.log('営担:', seller.visit_assignee || '（null）');
  console.log('訪問日:', seller.visit_date || '（null）');
  console.log('状況（当社）:', seller.status);
  console.log('更新日時:', seller.updated_at);

  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log('\n今日:', today.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][today.getDay()] + '曜)');

  // 訪問日を解析
  if (seller.visit_date) {
    const visitDate = new Date(seller.visit_date);
    visitDate.setHours(0, 0, 0, 0);
    const visitDay = visitDate.getDay();
    const daysB = visitDay === 4 ? 2 : 1;
    const notifyDate = new Date(visitDate);
    notifyDate.setDate(notifyDate.getDate() - daysB);

    console.log('訪問日:', visitDate.toISOString().split('T')[0], '(' + ['日','月','火','水','木','金','土'][visitDay] + '曜)');
    console.log('通知日（前営業日）:', notifyDate.toISOString().split('T')[0]);
    console.log('今日 === 通知日:', today.getTime() === notifyDate.getTime());
    console.log('\n営担が入力されている:', !!seller.visit_assignee);
    console.log('訪問日が入力されている:', !!seller.visit_date);
    console.log('訪問日前日の条件を満たす:', !!seller.visit_assignee && today.getTime() === notifyDate.getTime());
  }

  // seller_sidebar_countsを取得
  const { data: counts } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('\n=== seller_sidebar_counts（最新10件） ===');
  counts.forEach(row => {
    console.log(`${row.category}: ${row.count} (更新: ${row.updated_at})`);
  });
}

check();
