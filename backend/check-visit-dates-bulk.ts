import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  const targets = ['AA13802', 'AA13803', 'AA13825', 'AA13840', 'AA13863'];

  const { data } = await supabase
    .from('sellers')
    .select('seller_number, visit_date')
    .in('seller_number', targets);

  console.log('DB内のvisit_date:');
  data?.forEach((r: any) => {
    console.log(`  ${r.seller_number}: ${r.visit_date ?? 'null'}`);
  });
}

main().catch(console.error);
