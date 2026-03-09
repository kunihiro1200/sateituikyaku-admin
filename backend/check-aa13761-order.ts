import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // AA13761のinquiry_dateを確認
  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date, created_at, deleted_at')
    .eq('seller_number', 'AA13761')
    .single();

  console.log('AA13761:', seller);

  // inquiry_dateの降順で上位5件を確認
  const { data: top5 } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date, created_at')
    .is('deleted_at', null)
    .order('inquiry_date', { ascending: false, nullsFirst: false })
    .limit(5);

  console.log('\n反響日付降順 上位5件:');
  top5?.forEach(s => console.log(`  ${s.seller_number}: inquiry_date=${s.inquiry_date}`));
}

main();
