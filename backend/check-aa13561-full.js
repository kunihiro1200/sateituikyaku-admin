const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // AA13561の全フィールドを確認
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, status, valuation_assignee, phone_assignee, first_caller_initials')
    .eq('seller_number', 'AA13561')
    .single();
  
  console.log('AA13561の全フィールド:');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.log('error:', error);
  
  // "I" を含む可能性のあるフィールドを全て確認
  console.log('\n--- "I" 関連フィールド ---');
  if (data) {
    const fields = Object.entries(data).filter(([k, v]) => v === 'I' || (typeof v === 'string' && v.includes('I')));
    fields.forEach(([k, v]) => console.log(`${k}: ${v}`));
  }
}

main();
