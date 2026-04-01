import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function compare() {
  console.log('=== スプレッドシートとバックエンドを比較 ===\n');

  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log(`今日の日付（JST）: ${todayJST}\n`);

  // スプレッドシートの23件
  const spreadsheetSellers = [
    'AA2090', 'AA8736', 'AA9406', 'AA11165', 'AA12972', 'AA13022', 'AA13102',
    'AA13188', 'AA13237', 'AA13249', 'AA13296', 'AA13341', 'AA13453', 'AA13459',
    'AA13465', 'AA13499', 'AA13501', 'AA13507', 'AA13527', 'AA13549', 'AA13774',
    'AA13785', 'AA13876'
  ];

  console.log(`📊 スプレッドシートの売主: ${spreadsheetSellers.length}件\n`);

  // バックエンドのフィルタ結果
  const { data: backendSellers, error } = await supabase
    .from('sellers')
    .select('seller_number')
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

  console.log(`📊 バックエンドの売主: ${backendSellers?.length || 0}件\n`);

  const backendSellerNumbers = backendSellers?.map((s: any) => s.seller_number) || [];

  // スプレッドシートにあってバックエンドにない売主
  const missingInBackend = spreadsheetSellers.filter(s => !backendSellerNumbers.includes(s));
  console.log(`❌ スプレッドシートにあってバックエンドにない: ${missingInBackend.length}件`);
  if (missingInBackend.length > 0) {
    console.log(`   売主番号: ${missingInBackend.join(', ')}\n`);
  }

  // バックエンドにあってスプレッドシートにない売主
  const missingInSpreadsheet = backendSellerNumbers.filter((s: string) => !spreadsheetSellers.includes(s));
  console.log(`❌ バックエンドにあってスプレッドシートにない: ${missingInSpreadsheet.length}件`);
  if (missingInSpreadsheet.length > 0) {
    console.log(`   売主番号: ${missingInSpreadsheet.join(', ')}\n`);
  }

  // 差分の詳細を確認
  if (missingInBackend.length > 0) {
    console.log('=== スプレッドシートにあってバックエンドにない売主の詳細 ===');
    for (const sellerNumber of missingInBackend) {
      const { data: seller } = await supabase
        .from('sellers')
        .select('seller_number, status, next_call_date, exclusive_other_decision_meeting, contract_year_month, deleted_at')
        .eq('seller_number', sellerNumber)
        .single();
      
      if (seller) {
        console.log(`${sellerNumber}:`);
        console.log(`  status: ${seller.status}`);
        console.log(`  next_call_date: ${seller.next_call_date}`);
        console.log(`  exclusive_other_decision_meeting: ${seller.exclusive_other_decision_meeting || 'null'}`);
        console.log(`  contract_year_month: ${seller.contract_year_month}`);
        console.log(`  deleted_at: ${seller.deleted_at || 'null'}`);
      } else {
        console.log(`${sellerNumber}: DBに存在しない`);
      }
    }
  }
}

compare().catch(console.error);
