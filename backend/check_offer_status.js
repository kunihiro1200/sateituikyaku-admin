const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, offer_status, offer_date, offer_amount')
    .eq('property_number', 'AA12356')
    .single();
  console.log('offer_status:', JSON.stringify(data?.offer_status));
  console.log('offer_date:', JSON.stringify(data?.offer_date));
  console.log('error:', error?.message);
}
check();
