import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

// 環境変数を読み込む（backendディレクトリから実行される前提）
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugStatusCalculation() {
  console.log('🔍 [DEBUG] Fetching buyers 7278, 7148, 7104, 6930...\n');
  
  const buyerNumbers = ['7278', '7148', '7104', '6930'];
  
  for (const buyerNumber of buyerNumbers) {
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', parseInt(buyerNumber, 10))
      .single();
    
    if (error || !buyer) {
      console.error(`❌ Buyer ${buyerNumber} not found:`, error);
      continue;
    }
    
    console.log(`\n📊 Buyer ${buyerNumber}:`);
    console.log(`  follow_up_assignee: ${buyer.follow_up_assignee}`);
    console.log(`  next_call_date: ${buyer.next_call_date}`);
    console.log(`  latest_status: ${buyer.latest_status}`);
    console.log(`  viewing_date: ${buyer.viewing_date}`);
    console.log(`  broker_inquiry: ${buyer.broker_inquiry}`);
    
    // Calculate status
    const statusResult = calculateBuyerStatus(buyer);
    console.log(`  ✅ Calculated status: ${statusResult.status}`);
    console.log(`  Priority: ${statusResult.priority}`);
    console.log(`  Matched condition: ${statusResult.matchedCondition}`);
    console.log(`  Color: ${statusResult.color}`);
  }
  
  console.log('\n✅ Debug complete');
}

debugStatusCalculation().catch(console.error);
