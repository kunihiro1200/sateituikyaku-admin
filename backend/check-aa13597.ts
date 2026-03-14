import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sellerNumber = 'AA13597';

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number, status, deleted_at, contract_year_month')
    .eq('seller_number', sellerNumber)
    .single();

  if (error) {
    console.log('エラー:', error.message);
    return;
  }

  if (!seller) {
    console.log(`${sellerNumber} はDBに存在しません`);
    return;
  }

  console.log('DBの状態:', seller);
}

main();
