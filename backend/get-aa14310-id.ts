import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  const { data } = await supabase
    .from('sellers')
    .select('id, property_address')
    .eq('seller_number', 'AA14310')
    .single();
  
  console.log('AA14310 ID:', data?.id);
  console.log('AA14310 住所:', data?.property_address);
})();
