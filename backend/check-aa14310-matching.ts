import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// .env.localを読み込む
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

console.log('🔧 Supabase URL:', supabaseUrl ? '✅ 設定済み' : '❌ 未設定');
console.log('🔧 Supabase Key:', supabaseKey ? '✅ 設定済み' : '❌ 未設定');
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA14310Matching() {
  console.log('🔍 AA14310のマッチング情報を確認します...\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number, match_updated_at, match_areas, match_timing, match_price_min, match_price_max')
    .eq('seller_number', 'AA14310')
    .single();

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  if (!seller) {
    console.error('❌ AA14310が見つかりません');
    return;
  }

  console.log('✅ AA14310の情報:');
  console.log('  - seller_number:', seller.seller_number);
  console.log('  - match_updated_at:', seller.match_updated_at || '❌ NULL（マッチングボタンが押されていない）');
  console.log('  - match_areas:', seller.match_areas);
  console.log('  - match_timing:', seller.match_timing);
  console.log('  - match_price_min:', seller.match_price_min);
  console.log('  - match_price_max:', seller.match_price_max);

  console.log('\n');

  if (!seller.match_updated_at) {
    console.log('❌ match_updated_atがNULLです。');
    console.log('   → マッチングボタンを押し直してください。');
    console.log('   → または、手動でmatch_updated_atを設定する必要があります。');
  } else {
    console.log('✅ match_updated_atに値が入っています。');
    console.log('   → サイドバーの「マッチング」カテゴリに表示されるはずです。');
  }
}

checkAA14310Matching();
