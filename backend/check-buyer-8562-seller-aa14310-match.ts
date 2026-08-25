// 買主8562と売主AA14310のマッチング条件を確認するスクリプト

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkMatch() {
  console.log('[チェック開始] 買主8562と売主AA14310のマッチング条件を確認します\n');

  // 買主8562のデータを取得
  const { data: buyer, error: buyerError } = await supabase
    .from('buyers')
    .select('buyer_number, name, desired_area, desired_property_type, desired_timing, price_range_house, price_range_apartment, price_range_land, property_number, reception_date')
    .eq('buyer_number', '8562')
    .single();

  if (buyerError || !buyer) {
    console.error('[エラー] 買主8562が見つかりません:', buyerError);
    return;
  }

  console.log('【買主8562】');
  console.log('  名前:', buyer.name);
  console.log('  希望エリア:', buyer.desired_area);
  console.log('  希望種別:', buyer.desired_property_type);
  console.log('  希望時期:', buyer.desired_timing);
  console.log('  価格帯（戸建）:', buyer.price_range_house);
  console.log('  価格帯（マンション）:', buyer.price_range_apartment);
  console.log('  価格帯（土地）:', buyer.price_range_land);
  console.log('  物件番号:', buyer.property_number);
  console.log('  受付日:', buyer.reception_date);
  console.log('');

  // 売主AA14310のデータを取得
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('seller_number, name, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_updated_at, property_address, property_type')
    .eq('seller_number', 'AA14310')
    .single();

  if (sellerError || !seller) {
    console.error('[エラー] 売主AA14310が見つかりません:', sellerError);
    return;
  }

  console.log('【売主AA14310】');
  console.log('  名前:', seller.name);
  console.log('  マッチングエリア:', seller.match_areas);
  console.log('  エリア（自由入力）:', seller.match_area_free_text);
  console.log('  時期:', seller.match_timing);
  console.log('  価格帯（下限）:', seller.match_price_min);
  console.log('  価格帯（上限）:', seller.match_price_max);
  console.log('  更新日時:', seller.match_updated_at);
  console.log('  物件住所:', seller.property_address);
  console.log('  物件種別:', seller.property_type);
  console.log('');

  // マッチング判定
  console.log('【マッチング判定】');
  
  // エリアチェック
  const buyerAreas = buyer.desired_area ? buyer.desired_area.split('|').map((a: string) => a.trim()) : [];
  const sellerAreas = Array.isArray(seller.match_areas) ? seller.match_areas : [];
  const areaMatch = buyerAreas.some((ba: string) => sellerAreas.includes(ba));
  console.log('  エリア一致:', areaMatch ? '✅' : '❌');
  console.log('    - 買主エリア:', buyerAreas);
  console.log('    - 売主エリア:', sellerAreas);

  // 種別チェック
  const buyerType = buyer.desired_property_type;
  const sellerType = seller.property_type;
  console.log('  種別一致: (要確認)');
  console.log('    - 買主種別:', buyerType);
  console.log('    - 売主種別:', sellerType);

  // 価格帯チェック
  console.log('  価格帯:', '(要確認)');
  console.log('    - 売主価格帯:', `${seller.match_price_min ?? '下限なし'} 〜 ${seller.match_price_max ?? '上限なし'}`);
  console.log('    - 買主価格帯（戸建）:', buyer.price_range_house);
  console.log('    - 買主価格帯（マンション）:', buyer.price_range_apartment);
  console.log('    - 買主価格帯（土地）:', buyer.price_range_land);

  // 時期チェック
  console.log('  時期:');
  console.log('    - 買主:', buyer.desired_timing || '未入力');
  console.log('    - 売主:', seller.match_timing || '未入力');
  console.log('');

  // 売主のmatch_updated_atを確認
  if (!seller.match_updated_at) {
    console.log('⚠️  売主AA14310の match_updated_at が空です');
    console.log('    → マッチング条件が未入力の可能性があります');
    console.log('    → 通話モードページのマッチング結果には表示されません');
  } else {
    console.log('✅ 売主AA14310の match_updated_at が設定されています:', seller.match_updated_at);
  }
}

checkMatch()
  .then(() => {
    console.log('[完了]');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[エラー]', error);
    process.exit(1);
  });
