
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address, property_type, google_map_url, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA13800')
    .single();
  
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);
