// 買主番号7271と7272の存在と作成日時を確認
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkBuyers() {
  console.log('🔍 買主番号7271と7272を確認中...\n');

  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, name, created_at, updated_at')
    .in('buyer_number', ['7271', '7272'])
    .order('buyer_number');

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ 買主番号7271と7272はデータベースに存在しません');
    return;
  }

  console.log('✅ 見つかった買主:\n');
  for (const buyer of data) {
    console.log(`買主番号: ${buyer.buyer_number}`);
    console.log(`名前: ${buyer.name}`);
    console.log(`作成日時: ${buyer.created_at}`);
    console.log(`更新日時: ${buyer.updated_at}`);
    console.log('---');
  }

  // 7272が存在しない場合
  const found7271 = data.some(b => b.buyer_number === '7271');
  const found7272 = data.some(b => b.buyer_number === '7272');

  console.log(`\n📊 結果:`);
  console.log(`7271: ${found7271 ? '✅ 存在する' : '❌ 存在しない'}`);
  console.log(`7272: ${found7272 ? '✅ 存在する' : '❌ 存在しない'}`);
}

checkBuyers();
