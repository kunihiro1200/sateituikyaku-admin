import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './src/utils/encryption';
import * as crypto from 'crypto';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixHash() {
  console.log('🔧 AA13888のハッシュを修正します\n');

  // AA13888のデータを取得
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('id, seller_number, phone_number, email, phone_number_hash, email_hash')
    .eq('seller_number', 'AA13888')
    .is('deleted_at', null)
    .single();

  if (error || !seller) {
    console.log('❌ AA13888が見つかりません');
    return;
  }

  console.log('✅ AA13888が見つかりました');
  console.log('ID:', seller.id);
  console.log('現在の電話番号ハッシュ:', seller.phone_number_hash || '(空)');
  console.log('現在のメールハッシュ:', seller.email_hash || '(空)');

  // 電話番号とメールを復号
  let phoneNumber = '';
  let email = '';

  try {
    if (seller.phone_number) {
      phoneNumber = decrypt(seller.phone_number);
      console.log('\n復号した電話番号:', phoneNumber);
    }
    if (seller.email) {
      email = decrypt(seller.email);
      console.log('復号したメール:', email);
    }
  } catch (e: any) {
    console.log('❌ 復号エラー:', e.message);
    return;
  }

  // ハッシュを生成
  const phoneHash = phoneNumber ? crypto.createHash('sha256').update(phoneNumber).digest('hex') : null;
  const emailHash = email ? crypto.createHash('sha256').update(email).digest('hex') : null;

  console.log('\n生成した電話番号ハッシュ:', phoneHash);
  console.log('生成したメールハッシュ:', emailHash);

  // ハッシュを更新
  const { error: updateError } = await supabase
    .from('sellers')
    .update({
      phone_number_hash: phoneHash,
      email_hash: emailHash,
    })
    .eq('id', seller.id);

  if (updateError) {
    console.log('\n❌ 更新エラー:', updateError.message);
    return;
  }

  console.log('\n✅ ハッシュを更新しました');

  // 更新後のデータを確認
  const { data: updated } = await supabase
    .from('sellers')
    .select('phone_number_hash, email_hash')
    .eq('id', seller.id)
    .single();

  if (updated) {
    console.log('\n更新後の電話番号ハッシュ:', updated.phone_number_hash);
    console.log('更新後のメールハッシュ:', updated.email_hash);
  }

  // AA6271と一致するか確認
  const { data: aa6271 } = await supabase
    .from('sellers')
    .select('phone_number_hash, email_hash')
    .eq('seller_number', 'AA6271')
    .single();

  if (aa6271) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 AA6271との比較:');
    console.log('AA6271の電話番号ハッシュ:', aa6271.phone_number_hash);
    console.log('AA6271のメールハッシュ:', aa6271.email_hash);
    
    const phoneMatch = phoneHash === aa6271.phone_number_hash;
    const emailMatch = emailHash === aa6271.email_hash;
    
    console.log('\n電話番号ハッシュ一致:', phoneMatch ? '✅ はい' : '❌ いいえ');
    console.log('メールハッシュ一致:', emailMatch ? '✅ はい' : '❌ いいえ');
    
    if (phoneMatch || emailMatch) {
      console.log('\n✅ 重複として検出されるようになりました！');
    }
  }
}

fixHash().catch(console.error);
