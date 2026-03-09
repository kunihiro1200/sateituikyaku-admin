import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayJST = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
  
  // todayCallAssignedSellers のクエリ（getSidebarCounts と同じ）
  const { data: todayCallAssignedSellers } = await supabase
    .from('sellers')
    .select('id, visit_assignee')
    .is('deleted_at', null)
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .neq('visit_assignee', '外す')
    .lte('next_call_date', todayJST);

  const todayCallAssignedCounts: Record<string, number> = {};
  (todayCallAssignedSellers || []).forEach((s: any) => {
    const a = s.visit_assignee;
    if (a) todayCallAssignedCounts[a] = (todayCallAssignedCounts[a] || 0) + 1;
  });

  console.log('todayCallAssignedCounts:', JSON.stringify(todayCallAssignedCounts, null, 2));
  console.log('I count:', todayCallAssignedCounts['I']);
  
  // AA13561 が含まれているか確認
  const aa13561 = (todayCallAssignedSellers || []).find((s: any) => s.visit_assignee === 'I');
  console.log('\nI担当の売主数:', (todayCallAssignedSellers || []).filter((s: any) => s.visit_assignee === 'I').length);
  
  // AA13561 が todayCallAssignedSellers に含まれているか
  const { data: aa13561Data } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date')
    .eq('seller_number', 'AA13561')
    .single();
  
  const isInList = (todayCallAssignedSellers || []).some((s: any) => {
    // seller_number で確認するには id が必要
    return false; // id ベースでは確認できない
  });
  
  console.log('\nAA13561 data:', JSON.stringify(aa13561Data, null, 2));
  console.log('AA13561 visit_assignee:', aa13561Data?.visit_assignee);
  console.log('AA13561 is null?', aa13561Data?.visit_assignee === null);
}

main().catch(console.error);
