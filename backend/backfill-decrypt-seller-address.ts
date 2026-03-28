/**
 * 暗号化済み address データのバックフィル修正スクリプト
 *
 * 対象: sellers テーブルの address カラムが暗号化文字列になっているレコード
 *       （address は暗号化対象外フィールドだが、バグにより暗号化されて保存されていた）
 *
 * 処理内容:
 *   1. 全売主の address を取得
 *   2. 暗号文かどうかを判定（Base64 デコード後のバイト長が 96 以上）
 *   3. 暗号文の場合は decrypt() で復号して平文に更新
 *
 * 実行方法:
 *   npx ts-node backend/backfill-decrypt-seller-address.ts
 *
 * ドライランモード（実際には更新しない）:
 *   DRY_RUN=true npx ts-node backend/backfill-decrypt-seller-address.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
// .env も試みる（フォールバック）
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

const DRY_RUN = process.env.DRY_RUN === 'true';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;
const encryptionKey = process.env.ENCRYPTION_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

if (!encryptionKey) {
  console.error('❌ ENCRYPTION_KEY が設定されていません');
  process.exit(1);
}

if (encryptionKey.length !== 32) {
  console.error(`❌ ENCRYPTION_KEY は32文字である必要があります（現在: ${encryptionKey.length}文字）`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 暗号文かどうかを判定
 * AES-256-GCM 暗号文の最小長: IV(16) + SALT(64) + TAG(16) = 96 バイト → Base64 で 128 文字以上
 */
function isEncryptedValue(value: string): boolean {
  if (!value || value.length < 128) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= 96;
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM で復号する
 */
function decrypt(encryptedData: string): string {
  const key = Buffer.from(encryptionKey, 'utf8');
  const combined = Buffer.from(encryptedData, 'base64');

  // フォーマット: salt(64) + iv(16) + authTag(16) + encrypted(rest)
  const salt = combined.slice(0, 64);
  const iv = combined.slice(64, 80);
  const authTag = combined.slice(80, 96);
  const encrypted = combined.slice(96);

  const derivedKey = crypto.scryptSync(key, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

async function main() {
  console.log(`🔍 暗号化済み address データのバックフィル修正スクリプト`);
  console.log(`📋 モード: ${DRY_RUN ? 'ドライラン（更新しない）' : '本番実行'}`);
  console.log('');

  // 全売主の id, seller_number, address を取得（ページネーション対応）
  let allSellers: { id: string; seller_number: string; address: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, address')
      .is('deleted_at', null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('❌ データ取得エラー:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allSellers = allSellers.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`📊 取得した売主数: ${allSellers.length}`);

  // 暗号化済み address を持つ売主を抽出
  const encryptedSellers = allSellers.filter(
    (s) => s.address && isEncryptedValue(s.address)
  );

  console.log(`🔐 暗号化済み address を持つ売主数: ${encryptedSellers.length}`);

  if (encryptedSellers.length === 0) {
    console.log('✅ 修正が必要な売主はいません');
    return;
  }

  // 対象売主を表示
  console.log('');
  console.log('対象売主:');
  for (const seller of encryptedSellers) {
    console.log(`  - ${seller.seller_number} (id: ${seller.id})`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 ドライランモード: 実際には更新しません');
    return;
  }

  // 復号して更新
  let successCount = 0;
  let errorCount = 0;

  for (const seller of encryptedSellers) {
    try {
      const decryptedAddress = decrypt(seller.address!);

      const { error: updateError } = await supabase
        .from('sellers')
        .update({ address: decryptedAddress })
        .eq('id', seller.id);

      if (updateError) {
        console.error(`❌ ${seller.seller_number}: 更新エラー - ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`✅ ${seller.seller_number}: 復号完了`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`❌ ${seller.seller_number}: 復号エラー - ${err.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log(`📊 結果: 成功 ${successCount} 件 / エラー ${errorCount} 件`);

  if (successCount > 0) {
    console.log('');
    console.log('⚠️  DBの address が平文に修正されました。');
    console.log('   次回の DB→スプシ同期（売主データ更新時）に自動的にスプレッドシートにも反映されます。');
    console.log('   即時反映が必要な場合は、対象売主のデータを一度更新してください。');
  }
}

main().catch((err) => {
  console.error('❌ 予期しないエラー:', err);
  process.exit(1);
});
