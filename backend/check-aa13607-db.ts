import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address, visit_assignee, visit_date, current_status, status, next_call_date')
    .eq('seller_number', 'AA13607')
    .single();
  
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('seller data:', JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);
