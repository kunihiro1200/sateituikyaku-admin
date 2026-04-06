import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer5351() {
  console.log('買主5351の完全なデータを取得中...\n');
  
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '5351')
    .single();
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  if (!buyer) {
    console.log('買主5351が見つかりません');
    return;
  }
  
  console.log('買主5351のデータ:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  pinrich:', buyer.pinrich);
  console.log('  email:', buyer.email);
  console.log('  broker_inquiry:', buyer.broker_inquiry);
  console.log('  follow_up_assignee:', buyer.follow_up_assignee);
  console.log('  initial_assignee:', buyer.initial_assignee);
  console.log('  latest_viewing_date:', buyer.latest_viewing_date);
  console.log('  next_call_date:', buyer.next_call_date);
  console.log('  latest_status:', buyer.latest_status);
  console.log('');
  
  // ステータス計算
  const result = calculateBuyerStatus(buyer);
  console.log('計算されたステータス:');
  console.log('  status:', result.status);
  console.log('  priority:', result.priority);
  console.log('  matchedCondition:', result.matchedCondition);
}

checkBuyer5351();
