// visitAssignedCounts と todayCallAssignedCounts の両方を確認
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;

  // 旧クエリ（次電日条件なし）- 以前のバグのある実装
  const { data: oldQuery } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す');

  const oldCounts = {};
  (oldQuery || []).forEach(s => {
    const a = s.visit_assignee;
    if (a) oldCounts[a] = (oldCounts[a] || 0) + 1;
  });

  // 新クエリ（次電日条件あり）- 修正後の実装
  const { data: newQuery } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .lte('next_call_date', todayJST);

  const newCounts = {};
  (newQuery || []).forEach(s => {
    const a = s.visit_assignee;
    if (a) newCounts[a] = (newCounts[a] || 0) + 1;
  });

  console.log('=== 旧クエリ（次電日条件なし）===');
  console.log('I:', oldCounts['I'], '件');
  console.log('全担当者:', oldCounts);

  console.log('\n=== 新クエリ（次電日条件あり）===');
  console.log('I:', newCounts['I'], '件');
  console.log('全担当者:', newCounts);

  // AA13561 が旧クエリに含まれているか
  const aa13561Old = (oldQuery || []).find(s => s.seller_number === 'AA13561');
  console.log('\nAA13561 が旧クエリに含まれているか:', aa13561Old ? 'YES' : 'NO');
  
  // 旧クエリと新クエリの差分（I担当者）
  const oldI = (oldQuery || []).filter(s => s.visit_assignee === 'I').map(s => s.seller_number);
  const newI = (newQuery || []).filter(s => s.visit_assignee === 'I').map(s => s.seller_number);
  const diff = oldI.filter(n => !newI.includes(n));
  console.log('\n=== 旧クエリにあって新クエリにない I 担当者の売主（次電日が未来のもの）===');
  console.log('件数:', diff.length);
  console.log(diff);
}

main();
