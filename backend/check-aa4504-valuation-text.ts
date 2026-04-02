import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

(async () => {
  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_number, valuation_text, valuation_method, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA4504')
    .single();
  
  console.log('AA4504 valuation data:');
  console.log(JSON.stringify(seller, null, 2));
})();
