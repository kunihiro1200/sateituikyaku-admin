const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log('todayJST:', todayJST);

  // todayCallAssignedCounts のクエリ（visit_assignee = 'I' + 次電日 <= today）
  const { data } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .eq('visit_assignee', 'I')
    .lte('next_call_date', todayJST);

  console.log('visit_assignee=I かつ 次電日<=today の件数:', data?.length);
  
  // AA13561 が含まれているか
  const aa13561 = data?.find(s => s.seller_number === 'AA13561');
  console.log('AA13561 が含まれているか:', aa13561 ? 'YES（バグ）' : 'NO（正常）');
  
  // next_call_date が null の売主を確認
  const nullDate = data?.filter(s => !s.next_call_date);
  console.log('\nnext_call_date が null の売主:', nullDate?.length, '件');
  nullDate?.forEach(s => console.log(s.seller_number, s.next_call_date, s.status));
}

main();
