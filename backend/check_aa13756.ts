import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // まず全カラムを取得してカラム名を確認
  const { data, error } = await supabase
    .from('property_listings')
    .select('*')
    .eq('property_number', 'AA13756')
    .single();
  if (error) console.error('Error:', JSON.stringify(error));
  else {
    console.log('Columns:', Object.keys(data));
    console.log('google_map_url:', data.google_map_url);
    console.log('location:', data.location);
    console.log('address:', data.address);
  }
  process.exit(0);
}
check();
