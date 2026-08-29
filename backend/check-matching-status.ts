import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  const { data: aa14856 } = await supabase
    .from('sellers')
    .select('seller_number, match_updated_at, buy_match_updated_at')
    .eq('seller_number', 'AA14856')
    .single();
  
  console.log('AA14856:');
  console.log('  match_updated_at:', aa14856?.match_updated_at);
  console.log('  buy_match_updated_at:', aa14856?.buy_match_updated_at);
  
  const { data: aa14310 } = await supabase
    .from('sellers')
    .select('seller_number, match_updated_at, buy_match_updated_at')
    .eq('seller_number', 'AA14310')
    .single();
  
  console.log('');
  console.log('AA14310:');
  console.log('  match_updated_at:', aa14310?.match_updated_at);
  console.log('  buy_match_updated_at:', aa14310?.buy_match_updated_at);
})();
