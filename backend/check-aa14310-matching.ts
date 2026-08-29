import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkMatching() {
  console.log('Checking AA14310 matching data...\n');
  
  // 売主AA14310のマッチング条件を取得
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA14310')
    .single();
  
  if (sellerError || !seller) {
    console.error('売主AA14310が見つかりません:', sellerError);
    return;
  }
  
  console.log('=== 売主AA14310のマッチング条件（買いたい） ===');
  console.log('buy_match_areas:', seller.buy_match_areas);
  console.log('buy_match_area_free_text:', seller.buy_match_area_free_text);
  console.log('buy_match_timing:', seller.buy_match_timing);
  console.log('buy_match_price_min:', seller.buy_match_price_min);
  console.log('buy_match_price_max:', seller.buy_match_price_max);
  console.log('buy_match_property_types:', seller.buy_match_property_types);
  console.log('buy_match_memo:', seller.buy_match_memo);
  
  // 売却中の売主（マッチング候補）を取得
  const { data: sellers, error: sellersError } = await supabase
    .from('sellers')
    .select('seller_number, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_property_types, match_memo, property_address, status')
    .not('match_updated_at', 'is', null)
    .is('deleted_at', null);
  
  if (sellersError) {
    console.error('売主一覧の取得エラー:', sellersError);
    return;
  }
  
  console.log('\n=== 売却中の売主（候補） ===');
  console.log('総数:', sellers?.length || 0);
  
  if (sellers && sellers.length > 0) {
    console.log('\n最初の5件:');
    sellers.slice(0, 5).forEach(s => {
      console.log('\n売主番号:', s.seller_number);
      console.log('  match_areas:', s.match_areas);
      console.log('  match_area_free_text:', s.match_area_free_text);
      console.log('  match_timing:', s.match_timing);
      console.log('  match_price_min:', s.match_price_min);
      console.log('  match_price_max:', s.match_price_max);
      console.log('  match_property_types:', s.match_property_types);
      console.log('  property_address:', s.property_address);
      console.log('  status:', s.status);
    });
  }
  
  // AA14310の買いたい条件でマッチング判定
  console.log('\n=== マッチング判定 ===');
  
  const buyerAreas = Array.isArray(seller.buy_match_areas) ? seller.buy_match_areas : [];
  const buyerPropertyTypes = Array.isArray(seller.buy_match_property_types) ? seller.buy_match_property_types : [];
  
  console.log('AA14310のエリア:', buyerAreas);
  console.log('AA14310の種別:', buyerPropertyTypes);
  console.log('AA14310の金額帯:', seller.buy_match_price_min, '〜', seller.buy_match_price_max);
  
  let matchCount = 0;
  
  if (sellers) {
    for (const s of sellers) {
      if (s.seller_number === 'AA14310') continue; // 自分自身を除外
      
      const sellerAreas = Array.isArray(s.match_areas) ? s.match_areas : [];
      const sellerPropertyTypes = Array.isArray(s.match_property_types) ? s.match_property_types : [];
      
      // エリア判定
      const areaMatch = buyerAreas.length === 0 || sellerAreas.length === 0 || 
        buyerAreas.some(a => sellerAreas.includes(a));
      
      // 種別判定
      const typeMatch = buyerPropertyTypes.length === 0 || sellerPropertyTypes.length === 0 ||
        buyerPropertyTypes.some(t => sellerPropertyTypes.includes(t));
      
      // 金額判定（簡易版）
      const priceMatch = true; // 簡略化
      
      if (areaMatch && typeMatch && priceMatch) {
        matchCount++;
        if (matchCount <= 3) {
          console.log(`\nマッチ ${matchCount}: ${s.seller_number}`);
          console.log('  エリア:', sellerAreas);
          console.log('  種別:', sellerPropertyTypes);
          console.log('  金額:', s.match_price_min, '〜', s.match_price_max);
        }
      }
    }
  }
  
  console.log('\n総マッチ数:', matchCount);
}

checkMatching().then(() => {
  console.log('\nDone');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
