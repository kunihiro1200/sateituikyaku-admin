/**
 * 重複売主レコード削除スクリプト
 * 
 * 同一電話番号（復号して比較）+ inquiry_detailed_datetime のレコードが複数ある場合、
 * 最も若い seller_number を残して他を論理削除する。
 * また、phone_number_hashがnullのレコードにハッシュを設定する。
 * 
 * 使い方: npx ts-node cleanup-duplicates.ts
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

// 暗号化ユーティリティをインポート
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

async function fetchAllSellers(supabase: any) {
  const allSellers: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, phone_number, phone_number_hash, inquiry_detailed_datetime, created_at, property_address')
      .is('deleted_at', null)
      .not('inquiry_detailed_datetime', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allSellers.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allSellers;
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 重複レコードを検索中（全件取得＋電話番号復号）...');

  const allSellers = await fetchAllSellers(supabase);
  console.log(`📊 対象レコード数: ${allSellers.length}件`);

  // 電話番号を復号してグループ化
  const groups = new Map<string, any[]>();
  let hashFixCount = 0;

  for (const seller of allSellers) {
    if (!seller.phone_number) continue;
    
    let tel: string;
    try {
      tel = decrypt(seller.phone_number);
    } catch {
      continue;
    }
    if (!tel) continue;

    // phone_number_hashがnullの場合は補完する
    if (!seller.phone_number_hash) {
      const hash = crypto.createHash('sha256').update(tel).digest('hex');
      await supabase
        .from('sellers')
        .update({ phone_number_hash: hash })
        .eq('id', seller.id);
      seller.phone_number_hash = hash;
      hashFixCount++;
    }

    const key = `${tel}|${seller.inquiry_detailed_datetime}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(seller);
  }

  if (hashFixCount > 0) {
    console.log(`🔧 phone_number_hash補完: ${hashFixCount}件`);
  }

  // 重複グループを処理（2件以上あるグループ）
  let deletedCount = 0;
  const deletedSellers: string[] = [];

  for (const [_key, sellers] of groups) {
    if (sellers.length <= 1) continue;

    // 最も小さい seller_number を残す（連番が若い方）
    sellers.sort((a: any, b: any) => a.seller_number.localeCompare(b.seller_number));
    const keep = sellers[0];

    console.log(`\n📋 重複グループ (${sellers.length}件): ${sellers.map((s: any) => s.seller_number).join(', ')}`);
    console.log(`   残す: ${keep.seller_number} (${keep.property_address || '住所なし'})`);

    // 残り全てを論理削除
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
  } else {
    console.log('   重複レコードはありませんでした。');
  }
}

main().catch(console.error);
