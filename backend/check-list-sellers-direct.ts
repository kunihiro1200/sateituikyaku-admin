import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iqvvvqxqxqxqxqxqxqxq.supabase.co'; // 実際のURLに置き換え
const SUPABASE_SERVICE_KEY = 'your-service-key'; // 実際のキーに置き換え

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('=== listSellers with visitDayBefore category (Direct Query) ===');
  
  // 今日の日付（JST）
  const today = new Date();
  const todayJST = today.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  console.log('Today (JST):', todayJST);
  
  // 訪問日前日の条件
  // 営担あり + 今日が訪問日の前営業日（木曜訪問のみ2日前、それ以外は1日前）
  const { data: sellers, error, count } = await supabase
    .from('sellers')
    .select('*', { count: 'exact' })
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .not('visit_date', 'is', null)
    .range(0, 49); // ページ1、50件取得
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total count:', count);
  console.log('Data length:', sellers?.length);
  
  // 訪問日前日の条件を満たす売主をフィルタリング
  const visitDayBeforeSellers = (sellers || []).filter((seller: any) => {
    if (!seller.visit_assignee || !seller.visit_date) return false;
    
    const visitDate = new Date(seller.visit_date);
    const visitDay = visitDate.getDay();
    const daysBeforeVisit = visitDay === 4 ? 2 : 1; // 木曜訪問のみ2日前
    
    const notifyDate = new Date(visitDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
    
    const notifyDateStr = notifyDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    
    return notifyDateStr === todayJST;
  });
  
  console.log('Filtered sellers (visitDayBefore):', visitDayBeforeSellers.length);
  visitDayBeforeSellers.forEach((seller: any) => {
    console.log(`  - ${seller.seller_number}: visitAssignee=${seller.visit_assignee}, visitDate=${seller.visit_date}`);
  });
}

main().catch(console.error);
