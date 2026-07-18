import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.production'), override: true });

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data } = await supabase
    .from('sellers')
    .select('seller_number, created_at, inquiry_detailed_datetime, deleted_at')
    .in('seller_number', ['FI515', 'FI516', 'FI517'])
    .order('created_at');

  for (const s of data ?? []) {
    console.log(`${s.seller_number}: created=${s.created_at}, datetime=${s.inquiry_detailed_datetime}, deleted=${s.deleted_at}`);
  }
}
main().catch(console.error);
