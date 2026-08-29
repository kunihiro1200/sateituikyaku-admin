// マッチング削除のテスト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testDeleteMatchIntent() {
  // テスト対象の売主ID（AA14856）
  const sellerNumber = 'AA14856';
  
  console.log('=== マッチング削除テスト ===\n');
  
  // 1. 現在のデータを取得
  const { data: before, error: error1 } = await supabase
    .from('sellers')
    .select('id, seller_number, match_areas, match_updated_at, buy_match_areas, buy_match_updated_at')
    .eq('seller_number', sellerNumber)
    .single();
  
  if (error1 || !before) {
    console.error('売主が見つかりません:', error1);
    return;
  }
  
  console.log('【削除前】');
  console.log('  ID:', before.id);
  console.log('  match_areas:', before.match_areas);
  console.log('  match_updated_at:', before.match_updated_at);
  console.log('  buy_match_areas:', before.buy_match_areas);
  console.log('  buy_match_updated_at:', before.buy_match_updated_at);
  console.log('');
  
  // 2. 買いたいマッチングを削除
  console.log('買いたいマッチングを削除中...');
  const { error: error2 } = await supabase
    .from('sellers')
    .update({
      buy_match_areas: [],
      buy_match_area_free_text: null,
      buy_match_timing: null,
      buy_match_price_min: null,
      buy_match_price_max: null,
      buy_match_memo: null,
      buy_match_property_types: [],
      buy_match_updated_at: null,
    })
    .eq('id', before.id);
  
  if (error2) {
    console.error('削除に失敗:', error2);
    return;
  }
  
  console.log('削除リクエスト成功');
  console.log('');
  
  // 3. 削除後のデータを取得
  const { data: after, error: error3 } = await supabase
    .from('sellers')
    .select('id, seller_number, match_areas, match_updated_at, buy_match_areas, buy_match_updated_at')
    .eq('seller_number', sellerNumber)
    .single();
  
  if (error3 || !after) {
    console.error('削除後のデータ取得に失敗:', error3);
    return;
  }
  
  console.log('【削除後】');
  console.log('  ID:', after.id);
  console.log('  match_areas:', after.match_areas);
  console.log('  match_updated_at:', after.match_updated_at);
  console.log('  buy_match_areas:', after.buy_match_areas);
  console.log('  buy_match_updated_at:', after.buy_match_updated_at);
  console.log('');
  
  // 4. 確認
  if (after.buy_match_areas.length === 0 && after.buy_match_updated_at === null) {
    console.log('✅ 削除成功！');
  } else {
    console.log('❌ 削除失敗！データが残っています');
  }
}

testDeleteMatchIntent().catch(console.error);
