import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('property_listings')
    .select('property_number, address, latitude, longitude, google_map_url')
    .eq('property_number', 'AA13774')
    .single();
  console.log(JSON.stringify(data, null, 2));
}

check().catch(console.error);
