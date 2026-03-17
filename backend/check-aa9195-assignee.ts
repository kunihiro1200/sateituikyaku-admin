import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // AA9195の物件データを確認
  const { data: prop, error: propErr } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, seller_email, sales_assignee')
    .eq('property_number', 'AA9195')
    .single();

  if (propErr) {
    console.error('property_listings error:', propErr);
  } else {
    console.log('AA9195 property data:');
    console.log(JSON.stringify(prop, null, 2));
  }

  // employeesテーブルのinitials/nameを確認
  const { data: emps, error: empErr } = await supabase
    .from('employees')
    .select('id, name, email, initials, is_active')
    .eq('is_active', true)
    .order('name');

  if (empErr) {
    console.error('employees error:', empErr);
  } else {
    console.log('\nActive employees:');
    emps?.forEach(e => console.log(`  name="${e.name}" initials="${e.initials}" email="${e.email}"`));
  }
}

main().catch(console.error);
