import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, reception_date, created_datetime, name')
    .eq('buyer_number', '4369')
    .single();

  if (error) console.error('Error:', error);
  else console.log('Buyer 4369:', JSON.stringify(data, null, 2));
}

check().catch(console.error);
