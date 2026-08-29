import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkAA14856() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, match_areas, match_area_free_text, match_property_types, match_timing, match_price_min, match_price_max, property_address, property_type')
    .eq('seller_number', 'AA14856')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('AA14856の売りたいデータ:');
  console.log(JSON.stringify(data, null, 2));
}

checkAA14856();
