import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local を読み込む
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAA14856() {
  console.log('=== AA14856のマッチング状態を確認 ===\n');
  
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, buy_match_areas, buy_match_property_types, buy_match_updated_at')
    .eq('seller_number', 'AA14856')
    .single();
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('売主番号:', seller.seller_number);
  console.log('buy_match_areas:', seller.buy_match_areas);
  console.log('buy_match_property_types:', seller.buy_match_property_types);
  console.log('buy_match_updated_at:', seller.buy_match_updated_at);
  console.log('\n');
  
  if (seller.buy_match_updated_at === null) {
    console.log('✅ buy_match_updated_at は null（マッチング無効）');
  } else {
    console.log('❌ buy_match_updated_at に値あり（マッチング有効）');
  }
}

checkAA14856().catch(console.error);
