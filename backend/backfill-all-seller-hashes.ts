import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './src/utils/encryption';
import * as crypto from 'crypto';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function backfillHashes() {
  console.log('🔧 全売主のハッシュを一括生成します\n');

  // ハッシュが空の売主を取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('id, seller_number, phone_number, email, phone_number_hash, email_hash')
    .is('deleted_at', null)
    .or('phone_number_hash.is.null,email_hash.is.null');

  if (error) {
    console.log('❌ エラー:', error.message);
    return;
  }

  if (!sellers || sellers.length === 0) {
    console.log('✅ ハッシュが空の売主はありません');
    return;
  }

  console.log(`📊 ${sellers.length}件の売主にハッシュを生成します\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const seller of sellers) {
    try {
      // 電話番号とメールを復号
      let phoneNumber = '';
      let email = '';

      if (seller.phone_number) {
        try {
          phoneNumber = decrypt(seller.phone_number);
        } catch (e) {
          console.log(`⚠️  ${seller.seller_number}: 電話番号の復号に失敗`);
        }
      }

      if (seller.email) {
        try {
          email = decrypt(seller.email);
        } catch (e) {
          console.log(`⚠️  ${seller.seller_number}: メールの復号に失敗`);
        }
      }

      // ハッシュを生成
      const phoneHash = phoneNumber ? crypto.createHash('sha256').update(phoneNumber).digest('hex') : null;
      const emailHash = email ? crypto.createHash('sha256').update(email).digest('hex') : null;

      // 既にハッシュがある場合はスキップ
      if (seller.phone_number_hash && seller.email_hash) {
        continue;
      }

      // ハッシュを更新
      const updates: any = {};
      if (!seller.phone_number_hash && phoneHash) {
        updates.phone_number_hash = phoneHash;
      }
      if (!seller.email_hash && emailHash) {
        updates.email_hash = emailHash;
      }

      if (Object.keys(updates).length === 0) {
        continue;
      }

      const { error: updateError } = await supabase
        .from('sellers')
        .update(updates)
        .eq('id', seller.id);

      if (updateError) {
        console.log(`❌ ${seller.seller_number}: 更新エラー - ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${seller.seller_number}: ハッシュを生成`);
        successCount++;
      }
    } catch (e: any) {
      console.log(`❌ ${seller.seller_number}: エラー - ${e.message}`);
      errorCount++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 結果:');
  console.log(`✅ 成功: ${successCount}件`);
  console.log(`❌ エラー: ${errorCount}件`);
}

backfillHashes().catch(console.error);
