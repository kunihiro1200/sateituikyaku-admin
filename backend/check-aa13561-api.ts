import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // AA13561 の全フィールドを確認
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, visit_assignee_initials, next_call_date, status, deleted_at, phone_contact_person, preferred_contact_time, contact_method')
    .eq('seller_number', 'AA13561')
    .single();
  console.log('AA13561 full data:', JSON.stringify(data, null, 2));
  console.log('error:', error);

  // sellers テーブルのカラム一覧を確認（visit_assignee_initials が存在するか）
  const { data: cols } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13561')
    .single();
  if (cols) {
    console.log('\nAll columns:', Object.keys(cols));
    console.log('visit_assignee:', cols.visit_assignee);
    // visit_assignee_initials があるか確認
    console.log('visit_assignee_initials:', (cols as any).visit_assignee_initials);
  }
}

main().catch(console.error);
