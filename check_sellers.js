const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, visit_date, visit_assignee, inquiry_date, unreachable_status, pinrich_status, confidence_level, contact_method, preferred_contact_time, phone_contact_person')
    .in('seller_number', ['AA13824', 'AA13826', 'AA13806'])
    .is('deleted_at', null);
  
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
