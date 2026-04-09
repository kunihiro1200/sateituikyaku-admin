// AA12680の売主情報を確認するスクリプト
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './src/utils/encryption';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSeller() {
  const propertyNumber = 'AA12680';
  
  console.log(`🔍 Checking seller for property ${propertyNumber}...`);

  // 売主情報を取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('property_number', propertyNumber)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!seller) {
    console.log('❌ Seller not found');
    return;
  }

  console.log('✅ Seller found:');
  console.log('  seller_number:', seller.seller_number);
  console.log('  property_number:', seller.property_number);
  console.log('  name (encrypted):', seller.name);
  console.log('  email (encrypted):', seller.email);
  
  if (seller.email) {
    try {
      const decryptedEmail = decrypt(seller.email);
      console.log('  email (decrypted):', decryptedEmail);
    } catch (error: any) {
      console.error('  ❌ Failed to decrypt email:', error.message);
    }
  }
}

checkSeller()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
