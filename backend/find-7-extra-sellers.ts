import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function find7ExtraSellers() {
  console.log('=== 7件の余分な売主を特定 ===\n');

  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log(`今日の日付（JST）: ${todayJST}\n`);

  // バックエンドと同じ条件でクエリ
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
    .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
    .neq('next_call_date', todayJST)
    .eq('status', '一般媒介')
    .not('contract_year_month', 'is', null)
    .gte('contract_year_month', '2025-06-23')
    .is('deleted_at', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ バックエンドのフィルタリング結果: ${sellers?.length || 0}件\n`);
  console.log(`GASのカウント: 23件`);
  console.log(`差分: ${(sellers?.length || 0) - 23}件\n`);

  // 次電日が今日の売主を確認
  console.log('=== 次電日が今日の売主を確認 ===');
  const todaySellers = sellers?.filter((s: any) => s.next_call_date === todayJST);
  console.log(`次電日が今日: ${todaySellers?.length || 0}件`);
  if (todaySellers && todaySellers.length > 0) {
    todaySellers.forEach((s: any) => {
      console.log(`  ${s.seller_number}: next_call_date=${s.next_call_date}`);
    });
  }

  // 次電日がnullの売主を確認
  console.log('\n=== 次電日がnullの売主を確認 ===');
  const nullNextCallDate = sellers?.filter((s: any) => !s.next_call_date);
  console.log(`次電日がnull: ${nullNextCallDate?.length || 0}件`);

  // 契約年月が2025-06-23より前の売主を確認
  console.log('\n=== 契約年月が2025-06-23より前の売主を確認 ===');
  const beforeCutoff = sellers?.filter((s: any) => s.contract_year_month && s.contract_year_month < '2025-06-23');
  console.log(`契約年月が2025-06-23より前: ${beforeCutoff?.length || 0}件`);
  if (beforeCutoff && beforeCutoff.length > 0) {
    beforeCutoff.slice(0, 10).forEach((s: any) => {
      console.log(`  ${s.seller_number}: contract_year_month=${s.contract_year_month}`);
    });
  }
}

find7ExtraSellers().catch(console.error);
