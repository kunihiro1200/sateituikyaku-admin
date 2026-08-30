/**
 * 全売主の phone_number_hash 整合性チェック（読み取りのみ・更新しない）
 *
 * phone_number を復号して sha256 を計算し、DB上の phone_number_hash と比較する。
 * 不一致 / NULL のレコードは電話番号検索の高速パスでヒットしない。
 *
 * 使い方: npx ts-node backend/check-phone-hash-integrity.ts
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  try {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) return encryptedData;
    const buffer = Buffer.from(encryptedData, 'base64');
    if (buffer.length < IV_LENGTH + SALT_LENGTH + TAG_LENGTH) return encryptedData;
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const enc = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const d = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'utf-8'), iv);
    d.setAuthTag(tag);
    return d.update(enc.toString('hex'), 'hex', 'utf8') + d.final('utf8');
  } catch {
    return '';
  }
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

async function main() {
  console.log('='.repeat(80));
  console.log('phone_number_hash 整合性チェック（読み取りのみ）');
  console.log('='.repeat(80));

  let page = 0;
  const pageSize = 1000;
  let total = 0;
  let noPhone = 0;
  let nullHash = 0;
  let mismatch = 0;
  let ok = 0;
  const mismatchSamples: string[] = [];
  const nullHashSamples: string[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('seller_number, phone_number, phone_number_hash')
      .order('seller_number')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ 取得エラー:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const s of data) {
      total++;
      const phone = decrypt(s.phone_number || '');
      if (!phone) {
        noPhone++;
        continue;
      }
      if (!s.phone_number_hash) {
        nullHash++;
        if (nullHashSamples.length < 10) nullHashSamples.push(s.seller_number);
        continue;
      }
      if (sha256(phone) === s.phone_number_hash) {
        ok++;
      } else {
        mismatch++;
        if (mismatchSamples.length < 20) mismatchSamples.push(s.seller_number);
      }
    }

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n総レコード数            : ${total}件`);
  console.log(`  ✅ ハッシュ一致        : ${ok}件`);
  console.log(`  ❌ ハッシュ不一致      : ${mismatch}件  ← 電話番号検索の高速パスで漏れる`);
  console.log(`  ⚠️ ハッシュ未設定(NULL): ${nullHash}件  ← 同上`);
  console.log(`  － 電話番号なし        : ${noPhone}件`);

  if (mismatchSamples.length > 0) {
    console.log(`\n不一致の例: ${mismatchSamples.join(', ')}`);
  }
  if (nullHashSamples.length > 0) {
    console.log(`未設定の例: ${nullHashSamples.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
