import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from './src/utils/encryption';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testDecrypt() {
  const sellerNumbers = ['AA13175', 'AA10618'];
  
  for (const sellerNumber of sellerNumbers) {
    console.log(`\n=== ${sellerNumber} ===`);
    
    const { data, error } = await supabase
      .from('sellers')
      .select('seller_number, name')
      .eq('seller_number', sellerNumber)
      .single();
    
    if (error) {
      console.log('エラー:', error.message);
      continue;
    }
    
    if (!data) {
      console.log('データが見つかりません');
      continue;
    }
    
    console.log('売主番号:', data.seller_number);
    console.log('暗号化された名前:', data.name);
    
    try {
      const decryptedName = data.name ? decrypt(data.name) : null;
      console.log('復号後の名前:', decryptedName);
      console.log('復号成功:', decryptedName !== null && decryptedName !== '');
    } catch (err: any) {
      console.log('復号エラー:', err.message);
    }
  }
}

testDecrypt().catch(console.error);
