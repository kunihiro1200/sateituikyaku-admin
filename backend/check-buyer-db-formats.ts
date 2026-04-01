// DBの買主番号の形式を確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyerDBFormats() {
  console.log('=== DBの買主番号形式確認 ===\n');

  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!buyers || buyers.length === 0) {
    console.log('❌ 買主データが見つかりません');
    return;
  }

  console.log(`📊 最新の買主番号サンプル（${buyers.length}件）:\n`);

  let withBB = 0;
  let withoutBB = 0;

  buyers.forEach((buyer, index) => {
    const buyerNumber = buyer.buyer_number;
    console.log(`  ${index + 1}. "${buyerNumber}"`);

    if (buyerNumber && buyerNumber.match(/^BB\d+$/)) {
      withBB++;
    } else if (buyerNumber && buyerNumber.match(/^\d+$/)) {
      withoutBB++;
    }
  });

  console.log('');
  console.log('📊 形式分布:');
  console.log(`  BBプレフィックスあり: ${withBB}件`);
  console.log(`  BBプレフィックスなし: ${withoutBB}件`);

  // 7271と7272を検索
  console.log('');
  console.log('🔍 7271と7272の検索:');
  
  const { data: buyer7271 } = await supabase
    .from('buyers')
    .select('buyer_number, created_at')
    .or('buyer_number.eq.7271,buyer_number.eq.BB7271')
    .is('deleted_at', null)
    .single();

  const { data: buyer7272 } = await supabase
    .from('buyers')
    .select('buyer_number, created_at')
    .or('buyer_number.eq.7272,buyer_number.eq.BB7272')
    .is('deleted_at', null)
    .single();

  if (buyer7271) {
    console.log(`  ✅ 7271: "${buyer7271.buyer_number}" (作成日時: ${buyer7271.created_at})`);
  } else {
    console.log('  ❌ 7271: 見つかりません');
  }

  if (buyer7272) {
    console.log(`  ✅ 7272: "${buyer7272.buyer_number}" (作成日時: ${buyer7272.created_at})`);
  } else {
    console.log('  ❌ 7272: 見つかりません');
  }
}

checkBuyerDBFormats().catch(console.error);
