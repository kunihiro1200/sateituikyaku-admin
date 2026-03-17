// AA13774の半径3km距離マッチングで追加される買主を確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Haversine公式で距離計算
function calculateDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
    Math.cos((p2.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  // GeocodingServiceと同じAPIを使って大分市大字政所3798の座標を取得
  const { GeocodingService } = await import('./src/services/GeocodingService');
  const geocoding = new GeocodingService();

  const propertyAddress = '大分市大字政所３７９８';
  console.log(`物件住所: ${propertyAddress}`);

  const propertyGeo = await geocoding.geocodeAddress(propertyAddress);
  if (!propertyGeo) {
    console.error('物件住所のジオコーディング失敗');
    return;
  }
  const propertyCoords = { lat: propertyGeo.latitude, lng: propertyGeo.longitude };
  console.log(`物件座標: lat=${propertyCoords.lat}, lng=${propertyCoords.lng}`);

  // 配信種別「要」の買主を全件取得
  const buyers: any[] = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, desired_area, desired_property_type, latest_status, property_number, distribution_type, price_range_house')
      .is('deleted_at', null)
      .eq('distribution_type', '要')
      .not('latest_status', 'like', '%買付%')
      .not('latest_status', 'like', '%D%')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    buyers.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`\n配信種別「要」の買主総数: ${buyers.length}`);

  // 大分市㊵エリアマッチングで既に含まれる買主
  const areaMatchBuyers = buyers.filter(b => {
    const area = (b.desired_area || '').trim();
    if (!area) return true; // 希望エリア空欄は全エリア対象
    return area.includes('㊵');
  });
  console.log(`配信エリア㊵マッチング買主数: ${areaMatchBuyers.length}`);

  // エリアマッチングしない買主の中から距離マッチングを確認
  const nonAreaMatchBuyers = buyers.filter(b => {
    const area = (b.desired_area || '').trim();
    if (!area) return false; // 希望エリア空欄はエリアマッチング済み
    return !area.includes('㊵');
  });

  console.log(`\nエリアマッチングしない買主数: ${nonAreaMatchBuyers.length}`);
  console.log('距離マッチングを確認中...\n');

  // 各買主の問い合わせ物件の座標を取得して距離チェック
  const distanceMatchBuyers: any[] = [];
  const geocodingCache = new Map<string, { lat: number; lng: number } | null>();

  for (const buyer of nonAreaMatchBuyers) {
    const pn = (buyer.property_number || '').split(',')[0].trim();
    if (!pn) continue;

    let coords = geocodingCache.get(pn);
    if (coords === undefined) {
      const { data: prop } = await supabase
        .from('property_listings')
        .select('address')
        .eq('property_number', pn)
        .single();

      if (!prop?.address) {
        geocodingCache.set(pn, null);
        continue;
      }

      const geo = await geocoding.geocodeAddress(prop.address);
      if (!geo) {
        geocodingCache.set(pn, null);
        continue;
      }
      coords = { lat: geo.latitude, lng: geo.longitude };
      geocodingCache.set(pn, coords);
    }

    if (!coords) continue;

    const distance = calculateDistance(propertyCoords, coords);
    if (distance <= 3.0) {
      distanceMatchBuyers.push({
        buyer_number: buyer.buyer_number,
        name: buyer.name,
        desired_area: buyer.desired_area,
        desired_property_type: buyer.desired_property_type,
        inquiry_property: pn,
        distance_km: distance.toFixed(2),
      });
    }
  }

  console.log(`=== 距離マッチングで新たに追加される買主 (${distanceMatchBuyers.length}件) ===`);
  distanceMatchBuyers.forEach(b => {
    console.log(`買主番号: ${b.buyer_number} | 希望エリア: ${b.desired_area} | 問い合わせ物件: ${b.inquiry_property} | 距離: ${b.distance_km}km`);
  });
}

main().catch(console.error);
