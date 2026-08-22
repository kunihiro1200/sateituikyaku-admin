const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env.vercel.pulled' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

supabase
  .from('sellers')
  .select('seller_number, visit_assignee')
  .eq('seller_number', 'FI873')
  .single()
  .then(({ data, error }) => {
    console.log('data:', JSON.stringify(data));
    console.log('error:', JSON.stringify(error));
    process.exit(0);
  });
