import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  // FI762の詳細
  const { data: fi762 } = await supabase
    .from('sellers')
    .select('seller_number, status, visit_assignee, next_call_date, deleted_at')
    .eq('seller_number', 'FI762');
  console.log('=== FI762 ===');
  console.log(JSON.stringify(fi762, null, 2));

  // employeesテーブルでイニシャルKの人を確認
  const { data: emps } = await supabase
    .from('employees')
    .select('initials, name');
  console.log('\n=== employees ===');
  console.log(JSON.stringify(emps, null, 2));

  // visit_assigneeがフルネームになっている当日TEL（担当）対象の売主を確認
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayJST = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth()+1).padStart(2,'0')}-${String(jst.getUTCDate()).padStart(2,'0')}`;
  console.log('\n=== today JST:', todayJST, '===');

  // K担当の当日TEL対象（visit_assignee='K' OR フルネーム）
  const { data: sellers } = await supabase
    .from('sellers')
    .select('seller_number, status, visit_assignee, next_call_date')
    .is('deleted_at', null)
    .lte('next_call_date', todayJST)
    .or('status.ilike.%追客中%,status.eq.他決→追客')
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%一般媒介%')
    .not('status', 'ilike', '%他社買取%');

  const kSellers = (sellers || []).filter((s: any) => {
    const va = (s.visit_assignee || '').trim();
    return va === 'K' || va === '国広智子' || va === 'k';
  });
  console.log('\n=== K担当の当日TEL対象 ===');
  console.log(JSON.stringify(kSellers, null, 2));
  console.log('件数:', kSellers.length);
})();
