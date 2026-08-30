/**
 * 削除された売主レコードを全て復元するスクリプト
 * 
 * - deleted_atをnullに設定
 * - is_restoredフラグをtrueに設定（復元カテゴリで表示するため）
 * - restored_atに復元日時を記録
 * 
 * 使い方: npx ts-node backend/restore-all-deleted-sellers.ts
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

// 暗号化ユーティリティ
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== KEY_LENGTH) return null;
  return Buffer.from(key, 'utf-8');
}

function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  try {
    const key = getEncryptionKey();
    if (!key) return encryptedData;
    const buffer = Buffer.from(encryptedData, 'base64');
    const minLength = IV_LENGTH + SALT_LENGTH + TAG_LENGTH;
    if (buffer.length < minLength) return encryptedData;
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedData;
  }
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('='.repeat(80));
  console.log('削除された売主レコード復元スクリプト');
  console.log('='.repeat(80));

  // 削除されたレコードを全て取得
  const { data: deletedSellers, error: fetchError } = await supabase
    .from('sellers')
    .select('id, seller_number, name, phone_number, property_address, inquiry_site, inquiry_detailed_datetime, created_at, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (fetchError) {
    console.error('❌ エラー:', fetchError);
    return;
  }

  if (!deletedSellers || deletedSellers.length === 0) {
    console.log('✅ 削除されたレコードはありません。');
    return;
  }

  console.log(`\n📊 復元対象レコード数: ${deletedSellers.length}件\n`);

  // 確認
  console.log('以下のレコードを復元します:\n');
  for (const seller of deletedSellers.slice(0, 10)) {
    let name = '（暗号化）';
    try {
      if (seller.name) name = decrypt(seller.name);
    } catch {}
    console.log(`- ${seller.seller_number} (${name}) - 削除日時: ${seller.deleted_at}`);
  }
  if (deletedSellers.length > 10) {
    console.log(`... 他 ${deletedSellers.length - 10}件`);
  }

  console.log('\n⚠️  この操作を実行しますか？ (Ctrl+C でキャンセル)');
  console.log('10秒後に自動的に開始します...\n');

  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('復元を開始します...\n');

  let restoredCount = 0;
  const now = new Date().toISOString();

  for (const seller of deletedSellers) {
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        deleted_at: null,
        is_restored: true,
        restored_at: now,
      })
      .eq('id', seller.id);

    if (updateError) {
      console.error(`❌ ${seller.seller_number} の復元失敗: ${updateError.message}`);
    } else {
      let name = '（暗号化）';
      try {
        if (seller.name) name = decrypt(seller.name);
      } catch {}
      console.log(`✅ ${seller.seller_number} (${name}) を復元しました`);
      restoredCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ 復元完了: ${restoredCount}/${deletedSellers.length}件`);
  console.log('='.repeat(80));
  console.log('\n次のステップ:');
  console.log('1. サイドバーに「復元」カテゴリが追加されます');
  console.log('2. 「復元」カテゴリをクリックすると、復元されたレコードが表示されます');
  console.log('3. 復元されたレコードは通常のリストには表示されません（is_restored=trueでフィルタ）');
}

main().catch(console.error);
