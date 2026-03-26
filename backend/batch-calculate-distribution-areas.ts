/**
 * distribution_areasがnullの物件を一括計算・保存するバッチスクリプト
 * 実行: npx ts-node backend/batch-calculate-distribution-areas.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('🔄 distribution_areasが未設定の物件を一括計算・保存します...\n');

  // distribution_areasがnullかつgoogle_map_urlがある物件を取得
  const { data: properties, error } = await supabase
    .from('property_listings')
    .select('property_number, google_map_url, address, latitude, longitude')
    .is('distribution_areas', null)
    .not('google_map_url', 'is', null)
    .neq('google_map_url', '');

  if (error) {
    console.error('❌ 物件取得エラー:', error);
    process.exit(1);
  }

  console.log(`📊 対象物件数: ${properties?.length || 0}件\n`);

  if (!properties || properties.length === 0) {
    console.log('✅ 対象物件なし');
    return;
  }

  const { PropertyDistributionAreaCalculator } = await import('./src/services/PropertyDistributionAreaCalculator');
  const { CityNameExtractor } = await import('./src/services/CityNameExtractor');
  const calculator = new PropertyDistributionAreaCalculator();
  const cityExtractor = new CityNameExtractor();

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const property of properties) {
    try {
      const city = property.address ? cityExtractor.extractCityFromAddress(property.address) : null;
      const preloadedCoords = (property.latitude && property.longitude)
        ? { lat: Number(property.latitude), lng: Number(property.longitude) }
        : null;

      const result = await calculator.calculateDistributionAreas(
        property.google_map_url,
        city,
        property.address,
        preloadedCoords
      );

      if (!result.formatted) {
        console.log(`⚠️  ${property.property_number}: エリア計算結果なし（スキップ）`);
        skipped++;
        continue;
      }

      await supabase
        .from('property_listings')
        .update({ distribution_areas: result.formatted })
        .eq('property_number', property.property_number);

      console.log(`✅ ${property.property_number}: ${result.formatted}`);
      success++;

      // API負荷軽減のため少し待機
      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      console.error(`❌ ${property.property_number}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 完了: 成功=${success}, スキップ=${skipped}, 失敗=${failed}`);
}

main().catch(console.error);
