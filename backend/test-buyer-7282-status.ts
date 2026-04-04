import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

// 環境変数を最初に読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBuyer7282Status() {
  console.log('📊 買主7282のステータス計算をテスト中...\n');

  // 買主7282のデータを取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7282')
    .single();

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!buyer) {
    console.log('⚠️  買主7282が見つかりません');
    return;
  }

  console.log('✅ 買主7282のデータ:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  viewing_date:', buyer.viewing_date);
  console.log('  broker_inquiry:', buyer.broker_inquiry);
  console.log('  notification_sender:', buyer.notification_sender);
  console.log('  follow_up_assignee:', buyer.follow_up_assignee);
  console.log('  next_call_date:', buyer.next_call_date);
  console.log('  latest_status:', buyer.latest_status);
  console.log('');

  // ステータスを計算
  try {
    const statusResult = calculateBuyerStatus(buyer);
    console.log('✅ ステータス計算成功:');
    console.log('  status:', statusResult.status);
    console.log('  priority:', statusResult.priority);
    console.log('  matchedCondition:', statusResult.matchedCondition);
    console.log('  color:', statusResult.color);
  } catch (error: any) {
    console.error('❌ ステータス計算エラー:', error.message);
    console.error('   スタックトレース:', error.stack);
  }
}

testBuyer7282Status().catch(console.error);
