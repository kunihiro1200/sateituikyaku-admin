// 既存の物件リストにseller_emailを設定するスクリプト
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './src/utils/encryption';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updatePropertySellerEmails() {
  console.log('🔄 Updating property_listings with seller_email...');

  // 1. 全ての物件リストを取得
  const { data: properties, error: propertiesError } = await supabase
    .from('property_listings')
    .select('property_number');

  if (propertiesError) {
    console.error('❌ Error fetching properties:', propertiesError);
    return;
  }

  console.log(`📊 Found ${properties?.length || 0} properties`);

  // 2. 各物件の売主情報を取得してメールアドレスを更新
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const property of properties || []) {
    try {
      // 売主情報を取得（property_numberで検索）
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .select('email')
        .eq('property_number', property.property_number)
        .single();

      if (sellerError || !seller) {
        console.log(`⚠️  Seller not found for property ${property.property_number}`);
        skipped++;
        continue;
      }

      // メールアドレスを復号化
      const decryptedEmail = seller.email ? decrypt(seller.email) : null;

      if (!decryptedEmail) {
        skipped++;
        continue;
      }

      // 物件リストを更新
      const { error: updateError } = await supabase
        .from('property_listings')
        .update({ seller_email: decryptedEmail })
        .eq('property_number', property.property_number);

      if (updateError) {
        console.error(`❌ Error updating property ${property.property_number}:`, updateError);
        errors++;
      } else {
        console.log(`✅ Updated ${property.property_number} with email: ${decryptedEmail}`);
        updated++;
      }
    } catch (error: any) {
      console.error(`❌ Error processing property ${property.property_number}:`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Updated: ${updated}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

updatePropertySellerEmails()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
