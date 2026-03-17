// 買主2564がDBに存在するか、取得できているか確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function debug() {
  // 1. 直接取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, deleted_at, distribution_type, desired_area, desired_property_type, broker_inquiry, latest_status, reception_date')
    .eq('buyer_number', '2564')
    .single();

  console.log('直接取得:', JSON.stringify(buyer, null, 2));
  console.log('エラー:', error?.message);

  // 2. deleted_at=nullで取得できるか
  const { data: buyer2, error: e2 } = await supabase
    .from('buyers')
    .select('buyer_number, deleted_at')
    .eq('buyer_number', '2564')
    .is('deleted_at', null)
    .single();

  console.log('\ndeleted_at=nullで取得:', JSON.stringify(buyer2));
  console.log('エラー:', e2?.message);

  // 3. 全件取得の件数確認（ページネーション）
  const { count } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  console.log('\n全買主数(deleted_at=null):', count);

  // 4. reception_dateでソートした場合の2564の位置
  const { data: allBuyers } = await supabase
    .from('buyers')
    .select('buyer_number, reception_date')
    .is('deleted_at', null)
    .order('reception_date', { ascending: false, nullsFirst: false });

  const idx = allBuyers?.findIndex(b => b.buyer_number === '2564');
  console.log(`\nreceiption_dateソート後の2564の位置: ${idx === -1 ? '見つからない' : idx + 1}番目 / ${allBuyers?.length}件`);
  if (idx !== undefined && idx >= 0) {
    console.log(`  reception_date: ${allBuyers?.[idx]?.reception_date}`);
  }

  // 5. Supabaseのデフォルト1000件制限を超えているか確認
  if (count && count > 1000) {
    console.log(`\n⚠️  買主数が${count}件で1000件を超えています！Supabaseのデフォルト制限により全件取得できていません`);
  }
}

debug().catch(console.error);
