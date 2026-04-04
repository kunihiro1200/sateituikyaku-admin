import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus } from './src/utils/BuyerStatusCalculator';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('🔍 Testing calculateBuyerStatus...\n');

  // 買主を1件取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error fetching buyers:', error);
    return;
  }

  console.log(`✅ Fetched ${buyers?.length} buyers\n`);

  buyers?.forEach(buyer => {
    console.log(`\n📋 Buyer ${buyer.buyer_number}:`);
    console.log(`  - follow_up_assignee: ${buyer.follow_up_assignee}`);
    console.log(`  - initial_assignee: ${buyer.initial_assignee}`);
    console.log(`  - latest_status: ${buyer.latest_status}`);
    console.log(`  - next_call_date: ${buyer.next_call_date}`);
    
    try {
      const result = calculateBuyerStatus(buyer);
      console.log(`  ✅ calculated_status: "${result.status}"`);
      console.log(`  - priority: ${result.priority}`);
    } catch (error: any) {
      console.error(`  ❌ Error calculating status:`, error.message);
    }
  });
}

test().catch(console.error);
