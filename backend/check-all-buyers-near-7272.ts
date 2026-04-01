// 買主番号7270-7275付近の買主を確認
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyersNear7272() {
  console.log('🔍 買主番号7270-7275付近を確認中...\n');

  // 数値として比較
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, created_at')
    .gte('buyer_number', '7270')
    .lte('buyer_number', '7275')
    .order('buyer_number');

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ 買主番号7270-7275はデータベースに存在しません');
    return;
  }

  console.log(`✅ 見つかった買主: ${data.length}件\n`);
  for (const buyer of data) {
    console.log(`買主番号: ${buyer.buyer_number}`);
    console.log(`名前: ${buyer.name}`);
    console.log(`作成日時: ${buyer.created_at}`);
    console.log('---');
  }

  // 7271と7272の存在確認
  const found7271 = data.some((b: any) => b.buyer_number === '7271');
  const found7272 = data.some((b: any) => b.buyer_number === '7272');

  console.log(`\n📊 結果:`);
  console.log(`7271: ${found7271 ? '✅ DBに存在' : '❌ DBに存在しない'}`);
  console.log(`7272: ${found7272 ? '✅ DBに存在' : '❌ DBに存在しない'}`);
}

checkBuyersNear7272();
