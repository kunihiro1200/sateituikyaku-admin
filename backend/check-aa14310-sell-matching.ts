import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSellMatching() {
  console.log('Checking AA14310 売りたいマッチング...\n');
  
  // 売主AA14310の売却条件を取得
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA14310')
    .single();
  
  if (sellerError || !seller) {
    console.error('売主AA14310が見つかりません:', sellerError);
    return;
  }
  
  console.log('=== 売主AA14310の売却情報 ===');
  console.log('物件住所:', seller.property_address);
  console.log('物件種別:', seller.property_type);
  console.log('status:', seller.status);
  
  console.log('\n=== 売主AA14310のマッチング条件（売りたい） ===');
  console.log('match_areas:', seller.match_areas);
  console.log('match_area_free_text:', seller.match_area_free_text);
  console.log('match_timing:', seller.match_timing);
  console.log('match_price_min:', seller.match_price_min);
  console.log('match_price_max:', seller.match_price_max);
  console.log('match_property_types:', seller.match_property_types);
  console.log('match_memo:', seller.match_memo);
  console.log('match_updated_at:', seller.match_updated_at);
  
  // 買主候補を取得
  const { data: buyers, error: buyersError } = await supabase
    .from('buyers')
    .select('buyer_number, name, desired_areas, desired_area_free_text, desired_timing, desired_property_type, price_range_detached, price_range_mansion, price_range_land, inquired_property_address')
    .is('deleted_at', null);
  
  if (buyersError) {
    console.error('買主一覧の取得エラー:', buyersError);
    return;
  }
  
  console.log('\n=== 買主候補 ===');
  console.log('総数:', buyers?.length || 0);
  
  if (buyers && buyers.length > 0) {
    console.log('\n最初の5件:');
    buyers.slice(0, 5).forEach(b => {
      console.log('\n買主番号:', b.buyer_number);
      console.log('  名前:', b.name);
      console.log('  desired_areas:', b.desired_areas);
      console.log('  desired_area_free_text:', b.desired_area_free_text);
      console.log('  desired_timing:', b.desired_timing);
      console.log('  desired_property_type:', b.desired_property_type);
      console.log('  price_range_detached:', b.price_range_detached);
      console.log('  price_range_mansion:', b.price_range_mansion);
      console.log('  inquired_property_address:', b.inquired_property_address);
    });
  }
  
  // マッチング条件のチェック
  console.log('\n=== マッチング条件チェック ===');
  
  const sellerAreas = Array.isArray(seller.match_areas) ? seller.match_areas : [];
  const sellerPropertyTypes = Array.isArray(seller.match_property_types) ? seller.match_property_types : [];
  
  console.log('AA14310のエリア（構造化）:', sellerAreas);
  console.log('AA14310のエリア（自由入力）:', seller.match_area_free_text);
  console.log('AA14310の物件住所:', seller.property_address);
  console.log('AA14310の種別（構造化）:', sellerPropertyTypes);
  console.log('AA14310の物件種別:', seller.property_type);
  console.log('AA14310の金額帯:', seller.match_price_min, '〜', seller.match_price_max);
  
  const hasAnyCriteria = sellerAreas.length > 0 || !!seller.match_area_free_text || !!seller.property_address;
  console.log('\n条件あり（エリア/住所）:', hasAnyCriteria);
  
  if (!hasAnyCriteria) {
    console.log('\n⚠️ エラー: エリア条件が不足しています');
    console.log('  - match_areas が空');
    console.log('  - match_area_free_text が空');
    console.log('  - property_address が空');
    console.log('\nマッチングには以下のいずれかが必要です:');
    console.log('  1. match_areas にエリアを設定');
    console.log('  2. match_area_free_text に地名を入力');
    console.log('  3. property_address に物件住所が入っている（既に入っているはずですが...）');
  }
}

checkSellMatching().then(() => {
  console.log('\nDone');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
