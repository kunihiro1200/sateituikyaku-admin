import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // AA13688とAA13719のデータを確認
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, contact_method, preferred_contact_time, phone_contact_person, visit_assignee')
    .in('seller_number', ['AA13688', 'AA13719']);

  if (error) { console.error(error); return; }

  console.log('DBの生データ:');
  data?.forEach(s => {
    console.log(`\n${s.seller_number}:`);
    console.log(`  contact_method: ${JSON.stringify(s.contact_method)}`);
    console.log(`  preferred_contact_time: ${JSON.stringify(s.preferred_contact_time)}`);
    console.log(`  phone_contact_person: ${JSON.stringify(s.phone_contact_person)}`);
    console.log(`  visit_assignee: ${JSON.stringify(s.visit_assignee)}`);
  });
}

main().catch(console.error);
