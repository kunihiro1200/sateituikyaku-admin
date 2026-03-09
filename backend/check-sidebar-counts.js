// getSidebarCounts の実際の返り値を確認
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // JSTの今日
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log('todayJST:', todayJST);

  // todayCallAssignedSellers（営担あり + 次電日 <= today）
  const { data: todayCallAssignedSellers } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .lte('next_call_date', todayJST);

  console.log('\n=== todayCallAssignedSellers（営担あり + 次電日 <= today）===');
  console.log('件数:', todayCallAssignedSellers?.length);
  
  // 担当者別カウント
  const counts = {};
  (todayCallAssignedSellers || []).forEach(s => {
    const a = s.visit_assignee;
    if (a) counts[a] = (counts[a] || 0) + 1;
  });
  console.log('担当者別カウント:', counts);
  
  // "I" の担当者の売主を表示
  const iSellers = (todayCallAssignedSellers || []).filter(s => s.visit_assignee === 'I');
  console.log('\n=== visit_assignee = "I" の売主 ===');
  console.log('件数:', iSellers.length);
  iSellers.forEach(s => console.log(s.seller_number, s.visit_assignee));
  
  // AA13561 が含まれているか確認
  const aa13561 = (todayCallAssignedSellers || []).find(s => s.seller_number === 'AA13561');
  console.log('\nAA13561 が含まれているか:', aa13561 ? 'YES（バグ）' : 'NO（正常）');
}

main();
