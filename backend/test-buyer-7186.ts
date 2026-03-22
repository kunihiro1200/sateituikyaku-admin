import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.production.local' });

import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, next_call_date, follow_up_assignee, latest_status, viewing_result_follow_up, latest_viewing_date, deleted_at')
    .eq('buyer_number', '7186')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('7186のデータ:');
  console.log(JSON.stringify(data, null, 2));

  const result = calculateBuyerStatus(data as any);
  console.log('\nステータス計算結果:', result);
}

main().catch(console.error);
