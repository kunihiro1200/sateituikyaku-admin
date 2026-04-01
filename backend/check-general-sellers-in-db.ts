import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkGeneralSellers() {
  console.log('=== 一般カテゴリの売主をDBから確認 ===\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  console.log(`今日の日付: ${todayStr}\n`);

  // 一般カテゴリの条件
  // - exclusive_other_decision_meeting ≠ "完了"
  // - next_call_date ≠ 今日
  // - status = "一般媒介"
  // - contract_year_month >= "2025-06-23"

  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .gte('contract_year_month', '2025-06-23')
    .neq('exclusive_other_decision_meeting', '完了')
    .neq('next_call_date', todayStr)
    .is('deleted_at', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ 一般カテゴリの売主: ${sellers?.length || 0}件\n`);

  if (sellers && sellers.length > 0) {
    console.log('売主番号 | 状況 | 次電日 | 専任他決打合せ | 契約年月');
    console.log('---------|------|--------|--------------|----------');
    sellers.forEach((s: any) => {
      console.log(`${s.seller_number} | ${s.status} | ${s.next_call_date || 'null'} | ${s.exclusive_other_decision_meeting || 'null'} | ${s.contract_year_month || 'null'}`);
    });
  } else {
    console.log('⚠️ 一般カテゴリの売主が見つかりませんでした');
    console.log('\n原因の可能性:');
    console.log('1. スプレッドシートからDBへの同期が完了していない');
    console.log('2. GASの同期が10分ごとなので、次回同期を待つ必要がある');
    console.log('3. スプレッドシートのデータが条件を満たしていない');
  }

  // 全ての一般媒介売主を確認（条件なし）
  const { data: allGeneral, error: error2 } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .eq('status', '一般媒介')
    .is('deleted_at', null);

  console.log(`\n📊 全ての一般媒介売主: ${allGeneral?.length || 0}件`);
  if (allGeneral && allGeneral.length > 0) {
    console.log('\n売主番号 | 次電日 | 専任他決打合せ | 契約年月');
    console.log('---------|--------|--------------|----------');
    allGeneral.forEach((s: any) => {
      const meetsCondition = 
        s.exclusive_other_decision_meeting !== '完了' &&
        s.next_call_date !== todayStr &&
        s.contract_year_month && s.contract_year_month >= '2025-06-23';
      const mark = meetsCondition ? '✅' : '❌';
      console.log(`${mark} ${s.seller_number} | ${s.next_call_date || 'null'} | ${s.exclusive_other_decision_meeting || 'null'} | ${s.contract_year_month || 'null'}`);
    });
  }
}

checkGeneralSellers().catch(console.error);
