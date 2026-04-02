import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './src/utils/encryption';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('🔍 AA13888とAA6271の重複検出チェック\n');

  const { data: sellers } = await supabase
    .from('sellers')
    .select('id, seller_number, name, phone_number, email, phone_number_hash, email_hash')
    .in('seller_number', ['AA13888', 'AA6271'])
    .is('deleted_at', null);

  if (!sellers || sellers.length === 0) {
    console.log('❌ 売主が見つかりません');
    return;
  }

  console.log(`✅ ${sellers.length}件の売主が見つかりました\n`);

  for (const seller of sellers) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('売主番号:', seller.seller_number);
    console.log('ID:', seller.id);
    try {
      const name = seller.name ? decrypt(seller.name) : '(空)';
      const phone = seller.phone_number ? decrypt(seller.phone_number) : '(空)';
      const email = seller.email ? decrypt(seller.email) : '(空)';
      
      console.log('名前:', name);
      console.log('電話番号:', phone);
      console.log('メール:', email);
    } catch (e: any) {
      console.log('❌ 復号エラー:', e.message);
    }
    console.log('電話番号ハッシュ:', seller.phone_number_hash || '(空)');
    console.log('メールハッシュ:', seller.email_hash || '(空)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 重複判定:');
  
  if (sellers.length === 2) {
    const [s1, s2] = sellers;
    
    const phoneMatch = s1.phone_number_hash && s2.phone_number_hash && 
                       s1.phone_number_hash === s2.phone_number_hash;
    const emailMatch = s1.email_hash && s2.email_hash && 
                       s1.email_hash === s2.email_hash;
    
    console.log('電話番号ハッシュ一致:', phoneMatch ? '✅ はい' : '❌ いいえ');
    console.log('メールハッシュ一致:', emailMatch ? '✅ はい' : '❌ いいえ');
    
    if (phoneMatch || emailMatch) {
      console.log('\n✅ 重複として検出されるべきです');
    } else {
      console.log('\n❌ 重複として検出されません（ハッシュが一致していない）');
    }
  }
}

check().catch(console.error);
