/**
 * 買主番号7755の状態を確認するスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7755() {
  console.log('🔍 買主番号7755の状態を確認中...\n');

  // 1. DBに存在するか確認（削除済みも含む）
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7755')
    .maybeSingle();

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!buyer) {
    console.log('❌ 買主番号7755はDBに存在しません');
    console.log('   → スプレッドシートからDBへの同期が必要です');
  } else {
    console.log('✅ 買主番号7755はDBに存在します');
    console.log('\n📋 買主情報:');
    console.log('   ID:', buyer.id);
    console.log('   買主番号:', buyer.buyer_number);
    console.log('   物件番号:', buyer.property_number || '(なし)');
    console.log('   削除日時:', buyer.deleted_at || '(削除されていません)');
    console.log('   作成日時:', buyer.created_at);
    console.log('   更新日時:', buyer.updated_at);
  }

  // 2. 同じ物件番号の買主を確認
  if (buyer && buyer.property_number) {
    console.log(`\n🔍 物件番号 ${buyer.property_number} の買主を確認中...`);
    const { data: samePropBuyers, error: samePropError } = await supabase
      .from('buyers')
      .select('buyer_number, deleted_at')
      .eq('property_number', buyer.property_number)
      .order('buyer_number');

    if (!samePropError && samePropBuyers) {
      console.log(`   同じ物件の買主: ${samePropBuyers.length}件`);
      samePropBuyers.forEach(b => {
        const status = b.deleted_at ? '(削除済み)' : '';
        console.log(`   - ${b.buyer_number} ${status}`);
      });
    }
  }
}

checkBuyer7755()
  .then(() => {
    console.log('\n✅ 確認完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
