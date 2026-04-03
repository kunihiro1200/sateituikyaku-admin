import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log('🔍 Testing calculateBuyerStatus function...\n');

  // 買主7282を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*')
    .in('buyer_number', ['7282', '6829', '6841'])
    .order('buyer_number');

  if (error) {
    console.error('❌ Error fetching buyers:', error);
    return;
  }

  if (!buyers || buyers.length === 0) {
    console.log('❌ No buyers found');
    return;
  }

  console.log(`✅ Found ${buyers.length} buyers\n`);

  buyers.forEach((buyer: any) => {
    console.log(`\n📊 Buyer ${buyer.buyer_number}:`);
    console.log(`  viewing_date: ${buyer.viewing_date}`);
    console.log(`  viewing_assignee: ${buyer.viewing_assignee}`);
    console.log(`  broker_inquiry: ${buyer.broker_inquiry}`);
    console.log(`  notification_sender: ${buyer.notification_sender}`);
    
    try {
      const result = calculateBuyerStatus(buyer);
      console.log(`  ✅ calculated_status: "${result.status}"`);
      console.log(`  priority: ${result.priority}`);
      console.log(`  matchedCondition: ${result.matchedCondition}`);
    } catch (error: any) {
      console.error(`  ❌ Error calculating status:`, error.message);
      console.error(`  Stack:`, error.stack);
    }
  });
}

test().catch(console.error);
