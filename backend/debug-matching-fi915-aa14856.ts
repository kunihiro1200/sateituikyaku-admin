// FI915とAA14856のマッチング原因をデバッグ
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.localを読み込む（backendディレクトリから）
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debugMatching() {
  console.log('=== FI915とAA14856のマッチング原因デバッグ ===\n');

  // FI915のデータを取得
  const { data: fi915, error: error1 } = await supabase
    .from('sellers')
    .select('id, seller_number, name, property_address, match_areas, match_property_types, match_updated_at, buy_match_areas')
    .eq('seller_number', 'FI915')
    .single();

  if (error1 || !fi915) {
    console.error('FI915が見つかりません:', error1);
    return;
  }

  // AA14856のデータを取得
  const { data: aa14856, error: error2 } = await supabase
    .from('sellers')
    .select('id, seller_number, name, property_address, match_areas, match_property_types, match_updated_at, buy_match_areas')
    .eq('seller_number', 'AA14856')
    .single();

  if (error2 || !aa14856) {
    console.error('AA14856が見つかりません:', error2);
    return;
  }

  console.log('📍 FI915 (売りたい人):');
  console.log('  売主番号:', fi915.seller_number);
  console.log('  名前:', fi915.name);
  console.log('  物件住所:', fi915.property_address);
  console.log('  match_areas:', fi915.match_areas);
  console.log('  match_property_types:', fi915.match_property_types);
  console.log('  match_updated_at:', fi915.match_updated_at);
  console.log('  buy_match_areas:', fi915.buy_match_areas);
  console.log('');

  console.log('📍 AA14856 (買いたい人):');
  console.log('  売主番号:', aa14856.seller_number);
  console.log('  名前:', aa14856.name);
  console.log('  物件住所:', aa14856.property_address);
  console.log('  match_areas:', aa14856.match_areas);
  console.log('  match_property_types:', aa14856.match_property_types);
  console.log('  match_updated_at:', aa14856.match_updated_at);
  console.log('  buy_match_areas:', aa14856.buy_match_areas);
  console.log('');

  // エリアコードの重複チェック
  const fi915Areas = fi915.match_areas || [];
  const aa14856BuyAreas = aa14856.buy_match_areas || [];

  console.log('🔍 エリアコードの比較:');
  console.log('  FI915のmatch_areas:', fi915Areas);
  console.log('  AA14856のbuy_match_areas:', aa14856BuyAreas);

  const commonAreas = fi915Areas.filter((area: string) => aa14856BuyAreas.includes(area));
  if (commonAreas.length > 0) {
    console.log('  ❌ 共通エリアコード:', commonAreas);
    console.log('  → これが原因でマッチングしている可能性が高い');
  } else {
    console.log('  ✅ 共通エリアコードなし');
  }
  console.log('');

  // 住所の比較
  console.log('🔍 住所の比較:');
  console.log('  FI915の物件住所:', fi915.property_address);
  console.log('  AA14856の物件住所:', aa14856.property_address);
  
  const fi915Address = fi915.property_address || '';
  const aa14856Address = aa14856.property_address || '';
  
  if (fi915Address.includes('中央') || aa14856Address.includes('中央')) {
    console.log('  ⚠️ どちらかの住所に「中央」が含まれている');
    console.log('  → 住所の部分一致でマッチングしている可能性あり');
  }
}

debugMatching().catch(console.error);
