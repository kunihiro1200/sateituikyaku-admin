import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, comments, unreachable_status')
    .eq('seller_number', 'AA6')
    .single();

  if (error) { console.error('エラー:', error.message); return; }

  console.log('seller_number:', data?.seller_number);
  console.log('id:', data?.id);
  console.log('unreachable_status:', data?.unreachable_status);
  console.log('comments (全文):');
  console.log(data?.comments || '(null/空)');
}

main().catch(console.error);
