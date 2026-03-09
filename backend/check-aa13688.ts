import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, contact_method, preferred_contact_time, phone_contact_person, visit_assignee')
    .eq('seller_number', 'AA13688')
    .single();
  
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}

check();
