/**
 * 削除された売主レコードを全て確認するスクリプト
 * 
 * deleted_atが設定されているレコードを全て表示し、
 * いつ削除されたか、どのような条件で削除されたかを確認する。
 * 
 * 使い方: npx ts-node backend/check-all-deleted-sellers.ts
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
  console.log('削除された売主レコード確認');
  console.log('='.repeat(80));

  // deleted_atが設定されているレコードを全て取得
  const { data: deletedSellers, error } = await supabase
    .from('sellers')
    .select('id, seller_number, name, phone_number, property_address, inquiry_detailed_datetime, inquiry_site, created_at, deleted_at, updated_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!deletedSellers || deletedSellers.length === 0) {
    console.log('✅ 削除されたレコードはありません。');
    return;
  }

  console.log(`\n📊 削除されたレコード数: ${deletedSellers.length}件\n`);

  // 削除日時でグループ化
  const groupsByDeleteDate: Record<string, any[]> = {};
  for (const seller of deletedSellers) {
    const deleteDate = seller.deleted_at.split('T')[0]; // 日付のみ
    if (!groupsByDeleteDate[deleteDate]) {
      groupsByDeleteDate[deleteDate] = [];
    }
    groupsByDeleteDate[deleteDate].push(seller);
  }

  console.log('📅 削除日時別の件数:');
  console.log('-'.repeat(80));
  Object.entries(groupsByDeleteDate)
    .sort()
    .reverse()
    .forEach(([date, sellers]) => {
      console.log(`${date}: ${sellers.length}件`);
    });

  console.log('\n📋 削除されたレコード詳細:');
  console.log('-'.repeat(80));

  for (const seller of deletedSellers) {
    let name = '（暗号化）';
    let tel = '（暗号化）';
    
    try {
      if (seller.name) name = decrypt(seller.name);
      if (seller.phone_number) tel = decrypt(seller.phone_number);
    } catch {
      // 復号失敗
    }

    const deletedAt = new Date(seller.deleted_at);
    const createdAt = new Date(seller.created_at);
    const daysBetween = Math.floor((deletedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`\n売主番号: ${seller.seller_number}`);
    console.log(`  名前: ${name}`);
    console.log(`  電話番号: ${tel}`);
    console.log(`  物件住所: ${seller.property_address || '（なし）'}`);
    console.log(`  サイト: ${seller.inquiry_site || '（なし）'}`);
    console.log(`  反響日時: ${seller.inquiry_detailed_datetime || '（なし）'}`);
    console.log(`  作成日時: ${seller.created_at}`);
    console.log(`  削除日時: ${seller.deleted_at}`);
    console.log(`  削除まで: ${daysBetween}日間`);
  }

  // 2026年6月以降に削除されたレコード
  console.log('\n⚠️  2026年6月以降に削除されたレコード:');
  console.log('-'.repeat(80));
  
  const recentDeleted = deletedSellers.filter(s => {
    const deleteDate = new Date(s.deleted_at);
    return deleteDate >= new Date('2026-06-01');
  });

  if (recentDeleted.length === 0) {
    console.log('なし');
  } else {
    console.log(`件数: ${recentDeleted.length}件\n`);
    for (const seller of recentDeleted) {
      let name = '（暗号化）';
      try {
        if (seller.name) name = decrypt(seller.name);
      } catch {}
      console.log(`- ${seller.seller_number} (${name}) - 削除日時: ${seller.deleted_at}`);
    }
  }

  // イエウール案件で削除されたもの
  console.log('\n⚠️  イエウール案件で削除されたレコード:');
  console.log('-'.repeat(80));
  
  const ieulDeleted = deletedSellers.filter(s => s.inquiry_site === 'ウ');

  if (ieulDeleted.length === 0) {
    console.log('なし');
  } else {
    console.log(`件数: ${ieulDeleted.length}件\n`);
    for (const seller of ieulDeleted) {
      let name = '（暗号化）';
      try {
        if (seller.name) name = decrypt(seller.name);
      } catch {}
      console.log(`- ${seller.seller_number} (${name}) - 反響日時: ${seller.inquiry_detailed_datetime} - 削除日時: ${seller.deleted_at}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('確認完了');
  console.log('='.repeat(80));
}

main().catch(console.error);
