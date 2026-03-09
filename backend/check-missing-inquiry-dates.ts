import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // inquiry_dateがnullで最近作成された売主を確認
  const { data } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_date, inquiry_year, created_at')
    .is('deleted_at', null)
    .is('inquiry_date', null)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('inquiry_dateがnullの最近の売主（上位20件）:');
  data?.forEach(s => console.log(`  ${s.seller_number}: inquiry_year=${s.inquiry_year}, created_at=${s.created_at}`));
  console.log(`\n合計: ${data?.length}件`);
}

main();
