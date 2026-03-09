import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // AA13xxx番台の最新を確認
  const { data } = await supabase
    .from('sellers')
    .select('seller_number, created_at')
    .like('seller_number', 'AA13%')
    .order('seller_number', { ascending: false })
    .limit(10);

  console.log('AA13xxx番台の最新10件:');
  data?.forEach(s => console.log(`  ${s.seller_number}  (登録: ${s.created_at?.substring(0, 10)})`));

  // AA13761が存在するか確認
  const { data: target } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, status')
    .eq('seller_number', 'AA13761')
    .single();

  console.log('\nAA13761の状態:', target ? JSON.stringify(target) : '存在しない（未同期）');
}

main().catch(console.error);
