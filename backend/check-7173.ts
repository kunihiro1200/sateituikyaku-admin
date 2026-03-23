import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, latest_viewing_date, viewing_type_general, post_viewing_seller_contact, follow_up_assignee, latest_status, property_number')
    .eq('buyer_number', '7173')
    .single();
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
}
main();
