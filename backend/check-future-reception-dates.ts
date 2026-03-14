import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // reception_dateが今日より未来の買主を検索（2026年以降）
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, reception_date, created_datetime, name')
    .gte('reception_date', '2026-01-01')
    .order('reception_date', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`未来の受付日を持つ買主: ${data?.length ?? 0}件`);
  data?.forEach(b => {
    console.log(`  ${b.buyer_number}: reception_date=${b.reception_date}, created_datetime=${b.created_datetime}`);
  });
}

check().catch(console.error);
