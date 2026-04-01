import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkGeneralFilter() {
  console.log('=== 一般カテゴリのフィルタリング条件を確認 ===\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  console.log(`今日の日付: ${todayStr}\n`);

  // バックエンドと同じ条件でクエリ
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
    .neq('next_call_date', todayStr)
    .eq('status', '一般媒介')
    .not('contract_year_month', 'is', null)
    .gte('contract_year_month', '2025-06-23')
    .is('deleted_at', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ バックエンドのフィルタリング結果: ${sellers?.length || 0}件\n`);

  if (sellers && sellers.length > 0) {
    console.log('売主番号 | 次電日 | 専任他決打合せ | 契約年月');
    console.log('---------|--------|--------------|----------');
    sellers.slice(0, 50).forEach((s: any) => {
      console.log(`${s.seller_number} | ${s.next_call_date || 'null'} | ${s.exclusive_other_decision_meeting || 'null'} | ${s.contract_year_month || 'null'}`);
    });
    if (sellers.length > 50) {
      console.log(`... 他 ${sellers.length - 50}件`);
    }
  }

  // GASの条件（スプレッドシートベース）
  console.log('\n=== GASの条件で確認 ===');
  console.log('条件:');
  console.log('  - 専任他決打合せ ≠ "完了"');
  console.log('  - 次電日 ≠ 今日');
  console.log('  - 状況 = "一般媒介"');
  console.log('  - 契約年月 >= "2025-06-23"');
  console.log('\nGASのカウント: 23件（seller_sidebar_countsテーブルより）');
  console.log(`バックエンドのカウント: ${sellers?.length || 0}件`);
  console.log(`\n差分: ${(sellers?.length || 0) - 23}件`);

  // 差分の原因を調査
  if (sellers && sellers.length > 23) {
    console.log('\n🔍 差分の原因を調査:');
    console.log('次電日がnullの売主を確認...');
    const nullNextCallDate = sellers.filter((s: any) => !s.next_call_date);
    console.log(`  次電日がnull: ${nullNextCallDate.length}件`);
    if (nullNextCallDate.length > 0) {
      console.log('  売主番号:', nullNextCallDate.slice(0, 10).map((s: any) => s.seller_number).join(', '));
    }
  }
}

checkGeneralFilter().catch(console.error);
