import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, status, comments, unreachable_status, next_call_date, updated_at')
    .eq('seller_number', 'AA13761')
    .single();

  if (error) {
    console.log('エラー:', error.message);
    return;
  }

  console.log('DBの現在値:', JSON.stringify(seller, null, 2));
}

main();
