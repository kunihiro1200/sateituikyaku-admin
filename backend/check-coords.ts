import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // latitude/longitudeカラムが存在するか確認
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude')
    .not('latitude', 'is', null)
    .limit(3);

  if (error) {
    console.log('Error (latitude column may not exist):', error.message);
  } else {
    console.log('Sample with coords:', JSON.stringify(data, null, 2));
  }

  // AA13774の確認
  const { data: prop, error: e2 } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude')
    .eq('property_number', 'AA13774')
    .single();

  console.log('AA13774:', JSON.stringify(prop, null, 2), e2?.message);
}

check().catch(console.error);
