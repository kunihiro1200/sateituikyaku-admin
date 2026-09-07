/**
 * 特定の電話番号の全レコード状況を調査するスクリプト（読み取りのみ）
 *
 * - 削除済み（deleted_at IS NOT NULL）も含めて全件表示
 * - is_restored / restored_at / duplicate_confirmed の状態を表示
 * - 何が原因で1件だけになったのかを特定する
 *
 * 使い方: npx ts-node backend/check-specific-phone.ts <電話番号>
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const TARGET_PHONE = process.argv[2] || '09073172319';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function decrypt(value: string | null): string {
  if (!value) return '';
  try {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) return '(復号不可: キー未設定)';
    const buffer = Buffer.from(value, 'base64');
    if (buffer.length < IV_LENGTH + SALT_LENGTH + TAG_LENGTH) return '(復号不可: データ不正)';
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const enc = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const d = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'utf-8'), iv);
    d.setAuthTag(tag);
    return d.update(enc.toString('hex'), 'hex', 'utf8') + d.final('utf8');
  } catch (e: any) {
    return `(復号失敗: ${e.message})`;
  }
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

async function main() {
  console.log('='.repeat(80));
  console.log(`電話番号 ${TARGET_PHONE} の全レコード調査（削除済みも含む）`);
  console.log('='.repeat(80));

  const targetHash = sha256(TARGET_PHONE);
  console.log(`\nsha256("${TARGET_PHONE}") = ${targetHash}`);

  // 1. ハッシュで検索（削除済みも含む・全カラム）
  const { data: byHash, error: hashError } = await supabase
    .from('sellers')
    .select('*')
    .eq('phone_number_hash', targetHash);

  if (hashError) {
    console.error('❌ 検索エラー:', hashError.message);
  }

  console.log(`\n【phone_number_hash 一致】${byHash?.length || 0}件`);
  for (const s of byHash || []) {
    console.log('-'.repeat(60));
    console.log(`  売主番号                : ${s.seller_number}`);
    console.log(`  名前                    : ${decrypt(s.name)}`);
    console.log(`  電話番号（復号）        : ${decrypt(s.phone_number)}`);
    console.log(`  物件住所                : ${s.property_address}`);
    console.log(`  反響日付                : ${s.inquiry_date}`);
    console.log(`  反響詳細日時            : ${s.inquiry_detailed_datetime}`);
    console.log(`  サイト                  : ${s.inquiry_site}`);
    console.log(`  状況（当社）            : ${s.status}`);
    console.log(`  deleted_at              : ${s.deleted_at ?? '(null = 生存)'}`);
    console.log(`  is_restored             : ${s.is_restored ?? false}`);
    console.log(`  restored_at             : ${s.restored_at ?? '(null)'}`);
    console.log(`  duplicate_confirmed     : ${s.duplicate_confirmed ?? false}`);
    console.log(`  created_at              : ${s.created_at}`);
    console.log(`  updated_at              : ${s.updated_at}`);
  }

  // 2. 全件走査でも探す（ハッシュが壊れている可能性に備えて、平文比較でも確認）
  console.log('\n【平文の電話番号で全件走査（ハッシュに依存しない再確認）】');
  let page = 0;
  const pageSize = 1000;
  const plainMatches: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, name, phone_number, deleted_at, is_restored, inquiry_detailed_datetime, created_at, updated_at')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      const p = decrypt(r.phone_number);
      if (p.replace(/[^0-9]/g, '') === TARGET_PHONE.replace(/[^0-9]/g, '')) {
        plainMatches.push(r);
      }
    }
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`平文一致: ${plainMatches.length}件`);
  for (const s of plainMatches) {
    console.log(`  ${s.seller_number} | ${decrypt(s.name)} | deleted_at=${s.deleted_at ?? 'null'} | is_restored=${s.is_restored ?? false} | 反響=${s.inquiry_detailed_datetime} | created=${s.created_at} | updated=${s.updated_at}`);
  }

  if (plainMatches.length > (byHash?.length || 0)) {
    console.log('\n⚠️ 平文一致件数がハッシュ一致件数より多い → ハッシュが壊れているレコードが存在する');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
