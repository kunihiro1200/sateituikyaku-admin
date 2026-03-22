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
    .select('buyer_number, public_private, offer_status, distribution_type, viewing_type, viewing_type_general')
    .eq('buyer_number', '7148')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('7148の関連フィールド:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
