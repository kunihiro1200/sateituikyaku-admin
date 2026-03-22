import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7148')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('7148の全カラム:');
  console.log(Object.keys(data).join('\n'));
}

main().catch(console.error);
