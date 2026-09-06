import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load backend/.env
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env from:', envPath);
console.log('File exists:', fs.existsSync(envPath));
dotenv.config({ path: envPath });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Not set');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓ Set' : '✗ Not set');
console.log();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ 環境変数が読み込まれていません');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkFI1239() {
  console.log('🔍 FI1239の土地（当社調べ）を確認します...\n');

  // Get seller
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, seller_number, land_area_verified')
    .eq('seller_number', 'FI1239')
    .single();

  if (sellerError) {
    console.error('❌ Seller取得エラー:', sellerError);
    return;
  }

  console.log('📋 Seller データ:');
  console.log('  id:', seller.id);
  console.log('  seller_number:', seller.seller_number);
  console.log('  land_area_verified (売主テーブル):', seller.land_area_verified);
  console.log();

  // Get related property
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, land_area, land_area_verified')
    .eq('seller_id', seller.id);

  if (propError) {
    console.error('❌ Property取得エラー:', propError);
    return;
  }

  console.log('🏠 Property データ（全', properties.length, '件）:');
  
  if (properties.length === 0) {
    console.log('  → 物件テーブルと紐づいていません');
    console.log('  → InlineEditableFieldは売主テーブルのland_area_verifiedを更新するはずです');
  } else {
    properties.forEach((prop, idx) => {
      console.log(`\n  物件${idx + 1}:`);
      console.log('    id:', prop.id);
      console.log('    land_area:', prop.land_area);
      console.log('    land_area_verified:', prop.land_area_verified);
      
      if (prop.land_area_verified === 73) {
        console.log('    ⚠️  この物件に73が保存されています！');
      }
    });
  }
}

checkFI1239().catch(console.error);
