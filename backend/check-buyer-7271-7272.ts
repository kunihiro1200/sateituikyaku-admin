import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyers() {
  const { data: buyers } = await supabase
    .from('buyers')
    .select('buyer_number, created_at, synced_at')
    .in('buyer_number', ['7271', '7272', '7273'])
    .order('buyer_number');

  console.log('買主番号7271-7273のDB状態:');
  buyers?.forEach(b => {
    console.log(`  ${b.buyer_number}: created_at=${b.created_at}, synced_at=${b.synced_at}`);
  });

  const has7272 = buyers?.find(b => b.buyer_number === '7272');
  if (!has7272) {
    console.log('  7272: DBに存在しない');
  }
}

checkBuyers();
