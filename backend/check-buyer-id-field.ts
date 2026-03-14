import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number')
    .limit(3);

  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('サンプルデータ:');
    data?.forEach(row => {
      console.log(`  buyer_id=${row.buyer_id}, buyer_number=${row.buyer_number}`);
    });
    console.log('\n→ 主キーは buyer_id です（id ではない）');
  }
  process.exit(0);
}

main().catch(console.error);
