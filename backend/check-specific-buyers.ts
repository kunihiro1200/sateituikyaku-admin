import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSpecificBuyers() {
  const buyerNumbers = [7278, 7104, 6930, 7148];
  const todayStr = new Date().toISOString().split('T')[0];
  
  console.log(`📅 今日の日付: ${todayStr}\n`);
  
  for (const buyerNumber of buyerNumbers) {
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', buyerNumber)
      .single();
    
    if (error || !buyer) {
      console.log(`❌ 買主${buyerNumber}が見つかりません\n`);
      continue;
    }
    
    console.log(`📋 買主${buyerNumber}: ${buyer.name}`);
    console.log(`  follow_up_assignee: "${buyer.follow_up_assignee}"`);
    console.log(`  initial_assignee: "${buyer.initial_assignee}"`);
    console.log(`  next_call_date: "${buyer.next_call_date}"`);
    
    // 条件チェック
    const hasFollowUpAssignee = buyer.follow_up_assignee && buyer.follow_up_assignee !== '';
    const isU = buyer.follow_up_assignee === 'U';
    const hasNextCallDate = buyer.next_call_date && buyer.next_call_date !== '';
    let isNextCallDateTodayOrBefore = false;
    if (hasNextCallDate) {
      const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
      isNextCallDateTodayOrBefore = nextCallDateStr <= todayStr;
      console.log(`  next_call_date (formatted): "${nextCallDateStr}"`);
    }
    
    console.log(`  条件チェック:`);
    console.log(`    - follow_up_assigneeが空でない: ${hasFollowUpAssignee}`);
    console.log(`    - follow_up_assigneeがU: ${isU}`);
    console.log(`    - next_call_dateが空でない: ${hasNextCallDate}`);
    console.log(`    - next_call_dateが今日以前: ${isNextCallDateTodayOrBefore}`);
    console.log(`    → 当日TEL(U)に該当: ${hasFollowUpAssignee && isU && hasNextCallDate && isNextCallDateTodayOrBefore}`);
    console.log('');
  }
}

checkSpecificBuyers().catch(console.error);
