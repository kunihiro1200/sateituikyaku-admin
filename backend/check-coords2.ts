import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { count: total } = await supabase.from('property_listings').select('*', { count: 'exact', head: true });
  const { count: withCoords } = await supabase.from('property_listings').select('*', { count: 'exact', head: true }).not('latitude', 'is', null);
  console.log('Total:', total, 'With coords:', withCoords);

  const { data: buyers } = await supabase.from('buyers').select('buyer_number, property_number').not('property_number', 'is', null).limit(5);
  console.log('Buyers with property_number:', JSON.stringify(buyers, null, 2));
}
check().catch(console.error);
