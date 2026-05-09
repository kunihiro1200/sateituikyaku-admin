const { createClient } = require('@supabase/supabase-js');
const { decrypt } = require('./dist/utils/encryption');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // AA5279の売主データを取得
  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_number, name, email, property_address')
    .eq('seller_number', 'AA5279')
    .single();
  
  console.log('=== AA5279 sellers テーブル ===');
  console.log('seller_number:', seller.seller_number);
  console.log('property_address:', seller.property_address);
  console.log('name (暗号化):', seller.name);
  console.log('name (復号化):', decrypt(seller.name));
  console.log('email (暗号化):', seller.email);
  console.log('email (復号化):', decrypt(seller.email));
  console.log('');
  
  // AA5028の売主データも確認
  const { data: seller5028 } = await supabase
    .from('sellers')
    .select('seller_number, name, email, property_address')
    .eq('seller_number', 'AA5028')
    .single();
  
  console.log('=== AA5028 sellers テーブル（藤内様） ===');
  console.log('seller_number:', seller5028.seller_number);
  console.log('property_address:', seller5028.property_address);
  console.log('name (復号化):', decrypt(seller5028.name));
  console.log('email (復号化):', decrypt(seller5028.email));
})();
