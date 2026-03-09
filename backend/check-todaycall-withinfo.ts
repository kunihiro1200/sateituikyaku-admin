import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log('今日(JST):', todayJST);

  // todayCallWithInfoのクエリ（listSellersと同じ）
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method')
    .is('deleted_at', null)
    .ilike('status', '%追客中%')
    .lte('next_call_date', todayJST)
    .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
    .or('phone_contact_person.neq.,preferred_contact_time.neq.,contact_method.neq.');

  if (error) { console.error(error); return; }
  
  console.log(`\ntodayCallWithInfoクエリ結果: ${data?.length}件`);
  data?.forEach(s => {
    console.log(`  ${s.seller_number}: status=${s.status}, next_call=${s.next_call_date}, visit_assignee=${s.visit_assignee}, contact_method=${s.contact_method}, preferred_contact_time=${s.preferred_contact_time}, phone_contact_person=${s.phone_contact_person}`);
  });
}

check().catch(console.error);
