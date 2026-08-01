import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '.env.local') });
}
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAddressReading() {
  console.log('=== AA14129 物件住所の読み仮名修正 ===');

  // 1. AA14129の売主を取得
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address')
    .eq('seller_number', 'AA14129')
    .single();

  if (sellerError || !seller) {
    console.error('売主が見つかりません:', sellerError);
    return;
  }

  console.log('売主:', seller.seller_number);
  console.log('sellers.property_address:', seller.property_address);

  // 2. propertiesテーブルの物件住所を確認
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, property_address')
    .eq('seller_id', seller.id);

  if (propError) {
    console.error('物件取得エラー:', propError);
    return;
  }

  console.log('properties:', properties);

  // 3. 読み仮名を修正（おおはた → おばたけ）
  if (properties && properties.length > 0) {
    for (const prop of properties) {
      if (prop.property_address && prop.property_address.includes('（おおはた）')) {
        const newAddress = prop.property_address.replace('（おおはた）', '（おばたけ）');
        console.log(`\n修正: properties.property_address`);
        console.log(`  旧: ${prop.property_address}`);
        console.log(`  新: ${newAddress}`);

        const { error: updateError } = await supabase
          .from('properties')
          .update({ property_address: newAddress })
          .eq('id', prop.id);

        if (updateError) {
          console.error('properties更新エラー:', updateError);
        } else {
          console.log('  ✅ properties更新完了');
        }
      }
    }
  }

  // 4. sellersテーブルのproperty_addressも修正
  if (seller.property_address && seller.property_address.includes('（おおはた）')) {
    const newAddress = seller.property_address.replace('（おおはた）', '（おばたけ）');
    console.log(`\n修正: sellers.property_address`);
    console.log(`  旧: ${seller.property_address}`);
    console.log(`  新: ${newAddress}`);

    const { error: updateError } = await supabase
      .from('sellers')
      .update({ property_address: newAddress })
      .eq('id', seller.id);

    if (updateError) {
      console.error('sellers更新エラー:', updateError);
    } else {
      console.log('  ✅ sellers更新完了');
    }
  }

  console.log('\n=== 完了 ===');
}

fixAddressReading().catch(console.error);
