import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixLandAreaVerifiedSync() {
  console.log('🔧 propertiesテーブルからsellersテーブルへland_area_verifiedを同期します...\n');

  // propertiesテーブルにland_area_verifiedがある全件を取得
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, seller_id, land_area_verified, building_area_verified')
    .not('land_area_verified', 'is', null);

  if (propError) {
    console.error('❌ Properties取得エラー:', propError);
    return;
  }

  console.log(`📊 propertiesテーブルに land_area_verified がある物件: ${properties.length}件\n`);

  let syncCount = 0;
  let errorCount = 0;

  for (const prop of properties) {
    if (!prop.seller_id) continue;

    // sellersテーブルの現在の値を確認
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified')
      .eq('id', prop.seller_id)
      .single();

    if (sellerError || !seller) {
      console.error(`❌ Seller取得エラー (property_id: ${prop.id}):`, sellerError);
      errorCount++;
      continue;
    }

    // propertiesにあってsellersにない、または値が違う場合のみ更新
    if (prop.land_area_verified !== seller.land_area_verified) {
      const updateData: any = {};
      if (prop.land_area_verified !== null) {
        updateData.land_area_verified = prop.land_area_verified;
      }
      if (prop.building_area_verified !== null) {
        updateData.building_area_verified = prop.building_area_verified;
      }

      const { error: updateError } = await supabase
        .from('sellers')
        .update(updateData)
        .eq('id', prop.seller_id);

      if (updateError) {
        console.error(`❌ 更新エラー (${seller.seller_number}):`, updateError);
        errorCount++;
      } else {
        console.log(`✅ ${seller.seller_number}: properties(${prop.land_area_verified}) → sellers`);
        syncCount++;
      }
    }
  }

  console.log(`\n📊 同期結果:`);
  console.log(`   同期成功: ${syncCount}件`);
  console.log(`   エラー: ${errorCount}件`);
  console.log(`   合計処理: ${properties.length}件`);

  if (syncCount > 0) {
    console.log('\n✅ 同期完了！');
    console.log('   ブラウザでページをリロード（Ctrl+Shift+R）して確認してください');
  }
}

fixLandAreaVerifiedSync().catch(console.error);
