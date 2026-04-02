import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAA2Data() {
  console.log('🔍 AA2のデータを確認中...\n');

  try {
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('seller_number', 'AA2')
      .single();

    if (error) {
      console.error('❌ エラー:', error);
      return;
    }

    if (!seller) {
      console.log('❌ AA2が見つかりませんでした');
      return;
    }

    console.log('✅ AA2のデータ:');
    console.log(`  売主番号: ${seller.seller_number}`);
    console.log(`  種別: ${seller.property_type}`);
    console.log(`  土地面積: ${seller.land_area}㎡`);
    console.log(`  建物面積: ${seller.building_area}㎡`);
    console.log(`  築年: ${seller.build_year}`);
    console.log(`  固定資産税路線価: ${seller.fixed_asset_tax_road_price}`);
    console.log(`  査定額1: ${seller.valuation_amount_1 ? (seller.valuation_amount_1 / 10000) + '万円' : '空欄'}`);
    console.log(`  査定額2: ${seller.valuation_amount_2 ? (seller.valuation_amount_2 / 10000) + '万円' : '空欄'}`);
    console.log(`  査定額3: ${seller.valuation_amount_3 ? (seller.valuation_amount_3 / 10000) + '万円' : '空欄'}`);

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkAA2Data().catch(console.error);
