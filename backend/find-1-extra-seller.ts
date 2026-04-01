import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function find1ExtraSeller() {
  console.log('=== 1件の余分な売主を特定 ===\n');

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
    .is('deleted_at', null)
    .order('seller_number');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ バックエンドのフィルタリング結果: ${sellers?.length || 0}件\n`);

  console.log('売主番号 | 次電日 | 専任他決打合せ | 契約年月');
  console.log('---------|--------|--------------|----------');
  sellers?.forEach((s: any) => {
    console.log(`${s.seller_number} | ${s.next_call_date || 'null'} | ${s.exclusive_other_decision_meeting || 'null'} | ${s.contract_year_month || 'null'}`);
  });
}

find1ExtraSeller().catch(console.error);
