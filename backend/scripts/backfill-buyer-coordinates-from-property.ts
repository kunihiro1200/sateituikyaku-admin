/**
 * 買主の問合せ物件のGoogle Maps URLから座標を取得して
 * desired_area_lat / desired_area_lng に保存するバックフィルスクリプト
 *
 * 対象: desired_area_lat が NULL の買主（property_number が設定されているもの）
 * 方法: property_listings.google_map_url から座標を直接抽出（APIコール不要）
 */
import { createClient } from '@supabase/supabase-js';
import { GeolocationService } from '../src/services/GeolocationService';

const SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

async function backfillFromProperty() {
  console.log('=== 買主座標バックフィル（問合せ物件Google Maps URL使用）===\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const geoService = new GeolocationService();

  // 1. desired_area_lat が NULL で property_number がある買主を取得
  const { data: buyers, error: buyersError } = await supabase
    .from('buyers')
    .select('buyer_number, property_number')
    .is('desired_area_lat', null)
    .is('deleted_at', null)
    .not('property_number', 'is', null)
    .neq('property_number', '');

  if (buyersError) {
    console.error('買主取得エラー:', buyersError);
    return;
  }

  console.log(`座標なし買主数: ${buyers?.length || 0} 件\n`);

  if (!buyers || buyers.length === 0) {
    console.log('処理対象なし');
    return;
  }

  // 2. 全物件番号を収集（カンマ区切りの場合は最初の1件を使用）
  const propertyNumberSet = new Set<string>();
  const buyerPropertyMap = new Map<string, string>(); // buyer_number -> 最初の物件番号

  for (const buyer of buyers) {
    const firstProperty = buyer.property_number.split(',')[0].trim();
    if (firstProperty) {
      propertyNumberSet.add(firstProperty);
      buyerPropertyMap.set(buyer.buyer_number, firstProperty);
    }
  }

  const propertyNumbers = Array.from(propertyNumberSet);
  console.log(`対象物件数: ${propertyNumbers.length} 件`);

  // 3. property_listings から google_map_url を一括取得
  const { data: properties, error: propError } = await supabase
    .from('property_listings')
    .select('property_number, google_map_url, address')
    .in('property_number', propertyNumbers);

  if (propError) {
    console.error('物件取得エラー:', propError);
    return;
  }

  // 物件番号 -> google_map_url のマップ
  const propertyMapUrlMap = new Map<string, string>();
  for (const prop of properties || []) {
    if (prop.google_map_url) {
      propertyMapUrlMap.set(prop.property_number, prop.google_map_url);
    }
  }

  console.log(`Google Maps URL あり物件数: ${propertyMapUrlMap.size} 件\n`);

  // 4. 各買主の座標を更新
  let successCount = 0;
  let noUrlCount = 0;
  let parseFailCount = 0;
  let updateErrorCount = 0;

  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    const propertyNumber = buyerPropertyMap.get(buyer.buyer_number);

    if (!propertyNumber) {
      noUrlCount++;
      continue;
    }

    const googleMapUrl = propertyMapUrlMap.get(propertyNumber);
    if (!googleMapUrl) {
      console.log(`[${i + 1}/${buyers.length}] 買主 ${buyer.buyer_number} (物件 ${propertyNumber}): Google Maps URL なし → スキップ`);
      noUrlCount++;
      continue;
    }

    // Google Maps URL から座標を抽出（APIコール不要）
    const coords = await geoService.extractCoordinatesFromUrl(googleMapUrl);

    if (!coords) {
      console.log(`[${i + 1}/${buyers.length}] 買主 ${buyer.buyer_number} (物件 ${propertyNumber}): 座標抽出失敗 URL=${googleMapUrl}`);
      parseFailCount++;
      continue;
    }

    // DB更新
    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        desired_area_lat: coords.lat,
        desired_area_lng: coords.lng,
      })
      .eq('buyer_number', buyer.buyer_number);

    if (updateError) {
      console.error(`[${i + 1}/${buyers.length}] 買主 ${buyer.buyer_number}: 更新エラー`, updateError.message);
      updateErrorCount++;
    } else {
      console.log(`[${i + 1}/${buyers.length}] 買主 ${buyer.buyer_number} (物件 ${propertyNumber}): ✅ (${coords.lat}, ${coords.lng})`);
      successCount++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`✅ 成功: ${successCount} 件`);
  console.log(`⚠️  URL なし: ${noUrlCount} 件`);
  console.log(`❌ 座標抽出失敗: ${parseFailCount} 件`);
  console.log(`❌ DB更新エラー: ${updateErrorCount} 件`);
}

backfillFromProperty().catch(console.error);
