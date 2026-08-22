const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env.vercel.pulled' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
console.log('URL:', url ? url.substring(0, 40) + '...' : 'MISSING');
console.log('KEY:', key ? 'OK' : 'MISSING');

const supabase = createClient(url, key);

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
