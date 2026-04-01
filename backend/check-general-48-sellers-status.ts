import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check48Sellers() {
  console.log('=== 48件の売主の詳細を確認 ===\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  console.log(`今日の日付: ${todayStr}\n`);

  // バックエンドと同じ条件でクエリ
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month, updated_at')
    .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
    .neq('next_call_date', todayStr)
    .eq('status', '一般媒介')
    .not('contract_year_month', 'is', null)
    .gte('contract_year_month', '2025-06-23')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`✅ バックエンドのフィルタリング結果: ${sellers?.length || 0}件\n`);

  if (sellers && sellers.length > 0) {
    console.log('売主番号 | 次電日 | 契約年月 | 更新日時');
    console.log('---------|--------|----------|----------');
    sellers.forEach((s: any) => {
      const updatedAt = s.updated_at ? new Date(s.updated_at).toISOString().split('T')[0] : 'null';
      console.log(`${s.seller_number} | ${s.next_call_date || 'null'} | ${s.contract_year_month || 'null'} | ${updatedAt}`);
    });
  }

  // スプレッドシートに存在する3件を確認
  console.log('\n=== スプレッドシートに存在する3件 ===');
  const spreadsheetSellers = ['AA498', 'AA2090', 'AA3143'];
  for (const sellerNumber of spreadsheetSellers) {
    const seller = sellers?.find((s: any) => s.seller_number === sellerNumber);
    if (seller) {
      console.log(`✅ ${sellerNumber}: DBに存在`);
    } else {
      console.log(`❌ ${sellerNumber}: DBに存在しない`);
    }
  }

  // DBにあってスプレッドシートにない売主
  console.log('\n=== DBにあってスプレッドシートにない売主（最新10件） ===');
  const dbOnly = sellers?.filter((s: any) => !spreadsheetSellers.includes(s.seller_number)).slice(0, 10);
  dbOnly?.forEach((s: any) => {
    const updatedAt = s.updated_at ? new Date(s.updated_at).toISOString() : 'null';
    console.log(`${s.seller_number}: 更新日時=${updatedAt}`);
  });
}

check48Sellers().catch(console.error);
