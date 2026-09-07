/**
 * FI1201 の更新履歴・関連レコードを調査するスクリプト（読み取りのみ）
 *
 * - activities テーブルの履歴
 * - 反響日時 2026-08-29 前後の同一物件住所レコード（別の売主番号で重複登録された可能性）
 * - 反響日時 2026-08-29 19:34 前後の全レコード（同時刻の他の反響）
 *
 * 使い方: npx ts-node backend/check-fi1201-history.ts
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

function decrypt(value: string | null): string {
  if (!value) return '';
  try {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) return '';
    const buffer = Buffer.from(value, 'base64');
    if (buffer.length < IV_LENGTH + SALT_LENGTH + TAG_LENGTH) return '';
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

async function main() {
  // 1. FI1201 の id を取得
  const { data: fi1201 } = await supabase
    .from('sellers')
    .select('id, seller_number, name, phone_number, property_address, inquiry_detailed_datetime, created_at, updated_at')
    .eq('seller_number', 'FI1201')
    .single();

  if (!fi1201) {
    console.log('FI1201 が見つかりません');
    return;
  }

  console.log('='.repeat(80));
  console.log('FI1201 の活動履歴（activities）');
  console.log('='.repeat(80));
  const { data: activities, error: actError } = await supabase
    .from('activities')
    .select('*')
    .eq('seller_id', fi1201.id)
    .order('created_at', { ascending: true });

  if (actError) {
    console.log('activities取得エラー（テーブルが存在しないか列名が違う可能性）:', actError.message);
  } else {
    console.log(`${activities?.length || 0}件`);
    for (const a of activities || []) {
      console.log(`  ${a.created_at} | ${a.type || a.activity_type || ''} | ${(a.content || a.description || '').substring(0, 80)}`);
    }
  }

  // 2. 同一物件住所（別電話番号・別売主番号の可能性）
  console.log('\n' + '='.repeat(80));
  console.log(`物件住所が一致するレコード: "${fi1201.property_address}"`);
  console.log('='.repeat(80));
  const { data: sameAddress } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, inquiry_detailed_datetime, deleted_at, is_restored, created_at, updated_at')
    .eq('property_address', fi1201.property_address);

  for (const s of sameAddress || []) {
    console.log(`  ${s.seller_number} | ${decrypt(s.name)} | tel=${decrypt(s.phone_number)} | 反響=${s.inquiry_detailed_datetime} | deleted_at=${s.deleted_at ?? 'null'} | is_restored=${s.is_restored ?? false} | created=${s.created_at} | updated=${s.updated_at}`);
  }

  // 3. 同時刻帯（±2分）に登録された他の反響（同じ転記バッチで別番号として重複登録された可能性）
  console.log('\n' + '='.repeat(80));
  console.log('反響詳細日時 2026-08-29 19:32:00〜19:36:00 の全レコード');
  console.log('='.repeat(80));
  const { data: nearTime } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, property_address, inquiry_detailed_datetime, deleted_at, is_restored, created_at')
    .gte('inquiry_detailed_datetime', '2026-08-29 19:32:00')
    .lte('inquiry_detailed_datetime', '2026-08-29 19:36:00');

  for (const s of nearTime || []) {
    console.log(`  ${s.seller_number} | ${decrypt(s.name)} | tel=${decrypt(s.phone_number)} | addr=${s.property_address} | deleted_at=${s.deleted_at ?? 'null'} | is_restored=${s.is_restored ?? false} | created=${s.created_at}`);
  }

  console.log(`\nFI1201 の created_at: ${fi1201.created_at}`);
  console.log(`FI1201 の updated_at: ${fi1201.updated_at}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
