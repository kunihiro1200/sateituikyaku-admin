const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .update({ desired_property_type: '収益物件' })
    .eq('buyer_number', '7644')
    .select('buyer_number,desired_property_type');

  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('Updated:', JSON.stringify(data));
  }
}

main().catch(e => console.log('ERROR:', e.message));
