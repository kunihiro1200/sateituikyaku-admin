const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, status')
    .eq('seller_number', 'AA13561')
    .single();
  
  console.log('AA13561のデータ:');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.log('error:', error);
}

main();
