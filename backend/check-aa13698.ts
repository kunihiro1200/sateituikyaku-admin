import * as dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, unreachable_status, is_unreachable, next_call_date, updated_at')
    .eq('seller_number', 'AA13698')
    .single();

  if (error) { console.error('Error:', error.message); return; }
  console.log('AA13698 DB状態:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
