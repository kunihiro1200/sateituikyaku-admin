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
  // 全件取得して7186を探す（getStatusCategoriesと同じロジック）
  const PAGE_SIZE = 1000;
  const allBuyers: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('buyers')
      .select('*')
      .is('deleted_at', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed: ${error.message}`);
    if (!data || data.length === 0) break;
    allBuyers.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`全件数: ${allBuyers.length}`);

  const buyer7186 = allBuyers.find(b => b.buyer_number === '7186');
  if (!buyer7186) {
    console.log('7186が見つかりません（deleted_at が設定されている可能性）');
    return;
  }

  const result = calculateBuyerStatus(buyer7186);
  console.log('7186のステータス:', result.status);

  // ⑯当日TEL のカウント
  const todayTelBuyers = allBuyers.filter(b => {
    try {
      const r = calculateBuyerStatus(b);
      return r.status === '⑯当日TEL';
    } catch { return false; }
  });

  console.log(`\n⑯当日TEL の件数: ${todayTelBuyers.length}`);
  const nums = todayTelBuyers.map(b => b.buyer_number);
  console.log('含まれる買主番号（最初の20件）:', nums.slice(0, 20));
  console.log('7186が含まれるか:', nums.includes('7186'));
}

main().catch(console.error);
