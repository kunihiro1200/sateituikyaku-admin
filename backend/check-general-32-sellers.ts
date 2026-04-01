import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkGeneral32Sellers() {
  console.log('🔍 一般カテゴリで32件が表示される問題を調査...\n');

  // 今日の日付（JST）
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const todayJST = new Date(now.getTime() + jstOffset).toISOString().split('T')[0];
  console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

  // バックエンドフィルタと同じ条件で取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, contract_year_month, exclusive_other_decision_meeting')
    .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
    .neq('next_call_date', todayJST)
    .eq('status', '一般媒介')
    .or('contract_year_month.is.null,contract_year_month.gte.2025-06-23')
    .is('deleted_at', null)
    .order('seller_number');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 バックエンドフィルタで取得: ${sellers?.length || 0}件\n`);

  if (sellers && sellers.length > 0) {
    console.log('📋 取得された売主一覧:\n');
    console.log('売主番号 | 状況 | 次電日 | 契約年月 | 専任他決打合せ');
    console.log('---------|------|--------|----------|----------------');
    
    let nullContractCount = 0;
    let validContractCount = 0;
    
    sellers.forEach((seller: any) => {
      const contractYearMonth = seller.contract_year_month || 'null';
      const exclusiveMeeting = seller.exclusive_other_decision_meeting || 'null';
      
      if (seller.contract_year_month === null) {
        nullContractCount++;
      } else {
        validContractCount++;
      }
      
      console.log(
        `${seller.seller_number} | ${seller.status} | ${seller.next_call_date} | ${contractYearMonth} | ${exclusiveMeeting}`
      );
    });
    
    console.log('\n📊 集計:');
    console.log(`  - contract_year_month が null: ${nullContractCount}件`);
    console.log(`  - contract_year_month が >= 2025-06-23: ${validContractCount}件`);
    console.log(`  - 合計: ${sellers.length}件`);
  }
}

checkGeneral32Sellers().catch(console.error);
