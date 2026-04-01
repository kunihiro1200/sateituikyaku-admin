import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSellers() {
  console.log('=== AA498, AA2090, AA3143の詳細を確認 ===\n');

  const sellerNumbers = ['AA498', 'AA2090', 'AA3143'];

  for (const sellerNumber of sellerNumbers) {
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month')
      .eq('seller_number', sellerNumber)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error(`❌ ${sellerNumber}: エラー`, error);
      continue;
    }

    if (!seller) {
      console.log(`❌ ${sellerNumber}: 見つかりませんでした`);
      continue;
    }

    console.log(`\n📋 ${sellerNumber}:`);
    console.log(`   状況: ${seller.status}`);
    console.log(`   次電日: ${seller.next_call_date || 'null'}`);
    console.log(`   専任他決打合せ: ${seller.exclusive_other_decision_meeting || 'null'}`);
    console.log(`   契約年月: ${seller.contract_year_month || 'null'}`);

    // 条件チェック
    const today = '2026-03-31';
    const meetsCondition = 
      seller.status === '一般媒介' &&
      seller.exclusive_other_decision_meeting !== '完了' &&
      seller.next_call_date !== today &&
      seller.contract_year_month && seller.contract_year_month >= '2025-06-23';

    console.log(`   条件を満たす: ${meetsCondition ? '✅' : '❌'}`);

    if (!meetsCondition) {
      console.log(`   理由:`);
      if (seller.status !== '一般媒介') console.log(`     - 状況が一般媒介ではない: ${seller.status}`);
      if (seller.exclusive_other_decision_meeting === '完了') console.log(`     - 専任他決打合せが「完了」`);
      if (seller.next_call_date === today) console.log(`     - 次電日が今日（${today}）`);
      if (!seller.contract_year_month || seller.contract_year_month < '2025-06-23') {
        console.log(`     - 契約年月が2025-06-23より前: ${seller.contract_year_month || 'null'}`);
      }
    }
  }
}

checkSellers().catch(console.error);
