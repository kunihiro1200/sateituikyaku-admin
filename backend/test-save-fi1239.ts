import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load backend/.env
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 環境変数が読み込まれていません');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testSaveFI1239() {
  console.log('🧪 FI1239の土地（当社調べ）保存テストを開始します...\n');

  // Get seller
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, seller_number')
    .eq('seller_number', 'FI1239')
    .single();

  if (sellerError || !seller) {
    console.error('❌ Seller取得エラー:', sellerError);
    return;
  }

  console.log('📋 Seller:', seller.seller_number, seller.id);

  // Get property
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, land_area_verified')
    .eq('seller_id', seller.id);

  if (propError || properties.length === 0) {
    console.error('❌ Property取得エラー:', propError);
    return;
  }

  const property = properties[0];
  console.log('🏠 Property ID:', property.id);
  console.log('   現在のland_area_verified:', property.land_area_verified);
  console.log();

  // 62を保存
  console.log('💾 land_area_verifiedを62に更新します...');
  const { data: updateData, error: updateError } = await supabase
    .from('properties')
    .update({ land_area_verified: 62 })
    .eq('id', property.id)
    .select();

  if (updateError) {
    console.error('❌ 更新エラー:', updateError);
    return;
  }

  console.log('✅ 更新成功:', updateData);
  console.log();

  // 確認のため再取得
  console.log('🔍 更新後の値を確認します...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('properties')
    .select('land_area_verified')
    .eq('id', property.id)
    .single();

  if (verifyError) {
    console.error('❌ 確認エラー:', verifyError);
    return;
  }

  console.log('✅ 確認結果:', verifyData.land_area_verified);
  
  if (verifyData.land_area_verified === 62) {
    console.log('✅ 保存に成功しました！');
  } else {
    console.log('⚠️  保存されましたが、値が違います:', verifyData.land_area_verified);
  }
}

testSaveFI1239().catch(console.error);
