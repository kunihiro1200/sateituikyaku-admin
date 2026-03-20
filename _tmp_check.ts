
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, deleted_at, distribution_type, latest_status, desired_area, property_number')
    .eq('buyer_number', '6935');
  console.log(JSON.stringify({ data, error }, null, 2));
}
check();
