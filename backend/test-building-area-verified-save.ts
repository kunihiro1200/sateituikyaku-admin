/**
 * 建物面積（当社調べ）の保存をテストするスクリプト
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBuildingAreaVerifiedSave() {
  console.log('🧪 建物面積（当社調べ）の保存テスト\n');

  try {
    // 1. テスト用の売主を検索（最初の売主を使用）
    const { data: sellers, error: sellersError } = await supabase
      .from('sellers')
      .select('id, seller_number')
      .limit(1);

    if (sellersError || !sellers || sellers.length === 0) {
      console.error('❌ 売主の取得に失敗:', sellersError);
      return;
    }

    const testSeller = sellers[0];
    console.log(`📋 テスト売主: ${testSeller.seller_number} (ID: ${testSeller.id})\n`);

    // 2. 既存のpropertyレコードを確認
    const { data: existingProperty, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('seller_id', testSeller.id)
      .single();

    if (propertyError && propertyError.code !== 'PGRST116') {
      console.error('❌ 物件の取得に失敗:', propertyError);
      return;
    }

    if (existingProperty) {
      console.log('📋 既存の物件レコード:');
      console.log(`  - ID: ${existingProperty.id}`);
      console.log(`  - land_area_verified: ${existingProperty.land_area_verified}`);
      console.log(`  - building_area_verified: ${existingProperty.building_area_verified}\n`);

      // 3. building_area_verifiedを更新
      const testValue = 123.45;
      console.log(`🔄 building_area_verifiedを ${testValue} に更新中...\n`);

      const { data: updatedProperty, error: updateError } = await supabase
        .from('properties')
        .update({
          building_area_verified: testValue,
        })
        .eq('id', existingProperty.id)
        .select();

      if (updateError) {
        console.error('❌ 更新エラー:', updateError);
        return;
      }

      console.log('✅ 更新成功:');
      console.log(updatedProperty);

      // 4. 更新後の値を確認
      const { data: verifyProperty, error: verifyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', existingProperty.id)
        .single();

      if (verifyError) {
        console.error('❌ 確認エラー:', verifyError);
        return;
      }

      console.log('\n📋 更新後の値:');
      console.log(`  - land_area_verified: ${verifyProperty.land_area_verified}`);
      console.log(`  - building_area_verified: ${verifyProperty.building_area_verified}`);

      if (verifyProperty.building_area_verified === testValue) {
        console.log('\n✅ テスト成功: building_area_verifiedが正しく保存されました');
      } else {
        console.log('\n❌ テスト失敗: building_area_verifiedが保存されていません');
        console.log(`  期待値: ${testValue}`);
        console.log(`  実際の値: ${verifyProperty.building_area_verified}`);
      }
    } else {
      console.log('⚠️ 物件レコードが存在しません。新規作成が必要です。');
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testBuildingAreaVerifiedSave();
