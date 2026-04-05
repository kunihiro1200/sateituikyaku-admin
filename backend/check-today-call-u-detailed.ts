import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTodayCallUDetailed() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  console.log(`📅 今日の日付: ${todayStr}\n`);
  
  // 条件: follow_up_assignee = 'U' AND next_call_date <= 今日
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('follow_up_assignee', 'U')
    .lte('next_call_date', todayStr);
  
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log(`📊 条件を満たす買主: ${buyers?.length ?? 0}件\n`);
  
  if (buyers) {
    for (const buyer of buyers) {
      const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
      console.log(`📋 買主${buyer.buyer_number}: ${buyer.name}`);
      console.log(`  follow_up_assignee: "${buyer.follow_up_assignee}"`);
      console.log(`  next_call_date: "${buyer.next_call_date}" (formatted: ${nextCallDateStr})`);
      console.log(`  条件: follow_up_assignee='U' AND next_call_date<='${todayStr}'`);
      console.log(`  → 該当: ${buyer.follow_up_assignee === 'U' && nextCallDateStr <= todayStr}`);
      console.log('');
    }
  }
  
  console.log(`\n✅ 合計: ${buyers?.length ?? 0}件が「当日TEL(U)」の条件を満たしています`);
}

checkTodayCallUDetailed().catch(console.error);
