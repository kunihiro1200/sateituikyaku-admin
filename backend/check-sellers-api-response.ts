import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// employees キャッシュをシミュレート
async function getEmployeeNameByInitials(initials: string | null | undefined): Promise<string | null> {
  if (!initials) return null;
  
  const { data: employees } = await supabase
    .from('employees')
    .select('initials, name')
    .eq('is_active', true);
  
  const map = new Map((employees || []).map((e: any) => [e.initials, e.name]));
  return map.get(initials) || null;
}

async function main() {
  // AA13561 の decryptSeller をシミュレート
  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13561')
    .single();

  if (!seller) {
    console.log('AA13561 not found');
    return;
  }

  const visitAssigneeFullName = await getEmployeeNameByInitials(seller.visit_assignee);
  
  const decrypted = {
    visitAssignee: visitAssigneeFullName || seller.visit_assignee || undefined,
    visitAssigneeInitials: seller.visit_assignee || undefined,
    nextCallDate: seller.next_call_date,
    status: seller.status,
  };
  
  console.log('AA13561 decrypted:');
  console.log('  visitAssignee:', decrypted.visitAssignee);
  console.log('  visitAssigneeInitials:', decrypted.visitAssigneeInitials);
  console.log('  nextCallDate:', decrypted.nextCallDate);
  console.log('  status:', decrypted.status);
  
  // hasVisitAssignee のシミュレート
  const visitAssigneeCheck = decrypted.visitAssigneeInitials || seller.visit_assignee || decrypted.visitAssignee || '';
  console.log('\n  visitAssigneeCheck (for hasVisitAssignee):', JSON.stringify(visitAssigneeCheck));
  console.log('  hasVisitAssignee:', !(!visitAssigneeCheck || visitAssigneeCheck.trim() === '' || visitAssigneeCheck.trim() === '外す'));
  
  // isVisitAssignedTo('I') のシミュレート
  const isAssignedToI = visitAssigneeCheck.trim() === 'I';
  console.log('  isVisitAssignedTo(I):', isAssignedToI);
  
  // isTodayOrBefore のシミュレート
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayJST = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
  const nextCallDate = decrypted.nextCallDate || '';
  const isTodayOrBefore = nextCallDate <= todayJST;
  console.log('  todayJST:', todayJST);
  console.log('  nextCallDate:', nextCallDate);
  console.log('  isTodayOrBefore:', isTodayOrBefore);
  
  console.log('\n  isTodayCallAssignedTo(I):', isAssignedToI && isTodayOrBefore);
}

main().catch(console.error);
