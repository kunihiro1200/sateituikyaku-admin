import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkAllLandAreaVerified() {
  console.log('🔍 全売主の土地（当社調べ）の整合性を確認します...\n');

  // propertiesテーブルにland_area_verifiedがある全件を取得
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, seller_id, land_area_verified')
    .not('land_area_verified', 'is', null);

  if (propError) {
    console.error('❌ Properties取得エラー:', propError);
    return;
  }

  console.log(`📊 propertiesテーブルに land_area_verified がある物件: ${properties.length}件\n`);

  // 各物件について、sellersテーブルの値と比較
  const mismatches: any[] = [];
  
  for (const prop of properties) {
    if (!prop.seller_id) continue;

    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified')
      .eq('id', prop.seller_id)
      .single();

    if (sellerError || !seller) continue;

    // propertiesにあってsellersにない場合
    if (prop.land_area_verified !== null && seller.land_area_verified === null) {
      mismatches.push({
        seller_number: seller.seller_number,
        seller_id: prop.seller_id,
        property_id: prop.id,
        property_land_area_verified: prop.land_area_verified,
        seller_land_area_verified: seller.land_area_verified,
        issue: 'propertiesにあるがsellersにない',
      });
    }
    // 両方にあるが値が違う場合
    else if (prop.land_area_verified !== seller.land_area_verified) {
      mismatches.push({
        seller_number: seller.seller_number,
        seller_id: prop.seller_id,
        property_id: prop.id,
        property_land_area_verified: prop.land_area_verified,
        seller_land_area_verified: seller.land_area_verified,
        issue: '値が異なる',
      });
    }
  }

  console.log(`\n🚨 不整合が見つかった件数: ${mismatches.length}件\n`);

  if (mismatches.length > 0) {
    console.log('📋 不整合の詳細:\n');
    mismatches.slice(0, 20).forEach((m, idx) => {
      console.log(`${idx + 1}. ${m.seller_number}`);
      console.log(`   問題: ${m.issue}`);
      console.log(`   propertiesテーブル: ${m.property_land_area_verified}`);
      console.log(`   sellersテーブル: ${m.seller_land_area_verified}`);
      console.log();
    });

    if (mismatches.length > 20) {
      console.log(`   ... 他 ${mismatches.length - 20}件\n`);
    }

    console.log('💡 修正方法:');
    console.log('   1. propertiesテーブルの値をsellersテーブルに同期する');
    console.log('   2. または、PropertyService.updatePropertyメソッドが正しく同期しているか確認する');
  } else {
    console.log('✅ 不整合は見つかりませんでした');
  }

  // FI1239の状態を確認
  const fi1239 = mismatches.find(m => m.seller_number === 'FI1239');
  if (fi1239) {
    console.log('\n🎯 FI1239の不整合が確認されました');
    console.log('   これが「73に戻る」問題の原因です');
  } else {
    const { data: fi1239Seller } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified, id')
      .eq('seller_number', 'FI1239')
      .single();

    if (fi1239Seller) {
      const { data: fi1239Prop } = await supabase
        .from('properties')
        .select('land_area_verified')
        .eq('seller_id', fi1239Seller.id)
        .single();

      console.log('\n🎯 FI1239の状態:');
      console.log('   sellersテーブル:', fi1239Seller.land_area_verified);
      console.log('   propertiesテーブル:', fi1239Prop?.land_area_verified);
      
      if (fi1239Seller.land_area_verified === fi1239Prop?.land_area_verified) {
        console.log('   ✅ 整合性は取れています');
      }
    }
  }
}

checkAllLandAreaVerified().catch(console.error);
