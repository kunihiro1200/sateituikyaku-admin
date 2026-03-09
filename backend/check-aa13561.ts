import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status, deleted_at')
    .eq('seller_number', 'AA13561')
    .single();
  console.log('AA13561 data:', JSON.stringify(data, null, 2));
  console.log('error:', error);

  // todayCallAssignedCounts の条件でクエリ
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayJST = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
  console.log('todayJST:', todayJST);

  const { data: assigned } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .lte('next_call_date', todayJST)
    .eq('visit_assignee', 'I');

  console.log('I担当 todayCallAssigned sellers:', JSON.stringify(assigned, null, 2));
}

main().catch(console.error);
