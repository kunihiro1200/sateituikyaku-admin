import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debugBuyerStatusCalculation() {
  console.log('🔍 買主ステータス計算のデバッグ開始...\n');

  // 買主7282を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*')
    .in('buyer_number', ['7282', '7278', '7254'])
    .limit(3);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!buyers || buyers.length === 0) {
    console.log('❌ 買主が見つかりません');
    return;
  }

  console.log(`✅ ${buyers.length}件の買主を取得しました\n`);

  for (const buyer of buyers) {
    console.log(`\n📋 買主番号: ${buyer.buyer_number}`);
    console.log(`   viewing_date: ${buyer.viewing_date}`);
    console.log(`   notification_sender: ${buyer.notification_sender}`);
    console.log(`   broker_inquiry: ${buyer.broker_inquiry}`);
    console.log(`   follow_up_assignee: ${buyer.follow_up_assignee}`);
    console.log(`   next_call_date: ${buyer.next_call_date}`);

    try {
      const result = calculateBuyerStatus(buyer);
      console.log(`   ✅ calculated_status: "${result.status}"`);
      console.log(`   priority: ${result.priority}`);
      console.log(`   matchedCondition: ${result.matchedCondition}`);
    } catch (error: any) {
      console.error(`   ❌ エラー:`, error.message);
      console.error(`   スタック:`, error.stack);
    }
  }

  console.log('\n✅ デバッグ完了');
}

debugBuyerStatusCalculation().catch(console.error);
