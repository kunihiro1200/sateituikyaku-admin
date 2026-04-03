/**
 * AA13729のvisit_dateカラムを直接確認
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

async function checkVisitDate() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log('🔍 Checking AA13729 visit_date in database...\n');

  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, visit_date, visit_assignee')
    .eq('seller_number', 'AA13729')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Raw database data:');
  console.log('  - ID:', data.id);
  console.log('  - Seller Number:', data.seller_number);
  console.log('  - visit_date:', data.visit_date);
  console.log('  - visit_date type:', typeof data.visit_date);
  console.log('  - visit_assignee:', data.visit_assignee);
  console.log('\n📝 Full data:');
  console.log(JSON.stringify(data, null, 2));
}

checkVisitDate();
