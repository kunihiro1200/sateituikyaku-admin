import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// decryptSeller と同じロジックで visitAssignee を確認
async function main() {
  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, next_call_date, status, assignee, phone_assignee, valuation_assignee, first_call_initials, first_caller_initials')
    .eq('seller_number', 'AA13561')
    .single();

  console.log('AA13561 raw DB data:');
  console.log('  visit_assignee:', seller?.visit_assignee);
  console.log('  assignee:', seller?.assignee);
  console.log('  phone_assignee:', seller?.phone_assignee);
  console.log('  valuation_assignee:', seller?.valuation_assignee);
  console.log('  first_call_initials:', seller?.first_call_initials);
  console.log('  first_caller_initials:', seller?.first_caller_initials);
  console.log('  next_call_date:', seller?.next_call_date);
  console.log('  status:', seller?.status);

  // フロントエンドの hasVisitAssignee ロジックをシミュレート
  // seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee
  // decryptSeller では:
  //   visitAssignee: visitAssigneeFullName || seller.visit_assignee || undefined
  //   visitAssigneeInitials: seller.visit_assignee || undefined
  const visitAssigneeInitials = seller?.visit_assignee || undefined;
  const visitAssignee = seller?.visit_assignee || undefined; // visitAssigneeFullName が null の場合
  
  console.log('\nSimulated frontend data:');
  console.log('  visitAssigneeInitials:', visitAssigneeInitials);
  console.log('  visitAssignee:', visitAssignee);
  
  const hasVisitAssignee = !!(visitAssigneeInitials || visitAssignee);
  console.log('  hasVisitAssignee:', hasVisitAssignee);
  
  // isTodayCallAssignedTo('I') のシミュレート
  const isVisitAssignedToI = (visitAssigneeInitials || visitAssignee || '').trim() === 'I';
  console.log('  isVisitAssignedTo(I):', isVisitAssignedToI);
}

main().catch(console.error);
