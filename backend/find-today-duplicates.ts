/**
 * 今日作成された重複レコードを検索・削除するスクリプト
 * 
 * 同一電話番号で今日作成されたレコードが複数ある場合、
 * 最も若い seller_number を残して他を論理削除する。
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

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

  // 今日の日付（JST）
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const todayStr = jstNow.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`🔍 ${todayStr} に作成されたレコードを検索中...`);

  // 今日作成されたレコードを取得
  const { data: todaySellers, error } = await supabase
    .from('sellers')
    .select('id, seller_number, phone_number, phone_number_hash, inquiry_detailed_datetime, created_at, property_address, name')
    .is('deleted_at', null)
    .gte('created_at', `${todayStr}T00:00:00+09:00`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }

  console.log(`📊 今日作成されたレコード: ${todaySellers?.length || 0}件`);

  if (!todaySellers || todaySellers.length === 0) {
    console.log('今日作成されたレコードはありません。');
    return;
  }

  // 電話番号で復号してグループ化
  const groups = new Map<string, any[]>();

  for (const seller of todaySellers) {
    if (!seller.phone_number) continue;
    let tel: string;
    try {
      tel = decrypt(seller.phone_number);
    } catch {
      continue;
    }
    if (!tel) continue;

    if (!groups.has(tel)) {
      groups.set(tel, []);
    }
    groups.get(tel)!.push(seller);
  }

  // 重複表示
  let deletedCount = 0;
  const deletedSellers: string[] = [];

  for (const [tel, sellers] of groups) {
    if (sellers.length <= 1) continue;

    sellers.sort((a: any, b: any) => a.seller_number.localeCompare(b.seller_number));
    const keep = sellers[0];

    console.log(`\n📋 重複グループ (${sellers.length}件) tel=***${tel.slice(-4)}: ${sellers.map((s: any) => s.seller_number).join(', ')}`);
    console.log(`   住所: ${keep.property_address || '不明'}`);
    console.log(`   反響日時: ${sellers.map((s: any) => s.inquiry_detailed_datetime || 'null').join(', ')}`);
    console.log(`   残す: ${keep.seller_number}`);

    // 論理削除実行
    for (let i = 1; i < sellers.length; i++) {
      const toDelete = sellers[i];
      const { error: deleteError } = await supabase
        .from('sellers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', toDelete.id);

      if (deleteError) {
        console.error(`   ❌ ${toDelete.seller_number} の削除失敗: ${deleteError.message}`);
      } else {
        console.log(`   🗑️ 削除: ${toDelete.seller_number}`);
        deletedSellers.push(toDelete.seller_number);
        deletedCount++;
      }
    }
  }

  console.log(`\n✅ 完了: ${deletedCount}件の重複レコードを論理削除しました`);
  if (deletedSellers.length > 0) {
    console.log(`   削除した売主番号: ${deletedSellers.join(', ')}`);
  }
}

main().catch(console.error);
