/**
 * phone_number_hash / email_hash を平文から再計算して修復するスクリプト
 *
 * 【背景】
 * 過去のバックフィルが ENCRYPTION_KEY 未設定/不正な状態で実行され、
 * decrypt() が暗号文をそのまま返した値をハッシュ化してしまった。
 * その結果 sha256(暗号文) が保存され、電話番号検索・重複検出が機能していなかった。
 * （例: FI589 海出 務 / 08039968317 が電話番号検索でヒットしない）
 *
 * 【安全対策】
 * - ENCRYPTION_KEY が正しく復号できることを事前検証する（できなければ中断）
 * - 復号に失敗したレコードはスキップ（誤ったハッシュを書かない）
 * - 既に正しいハッシュのレコードは更新しない
 * - --dry-run で更新せず件数だけ確認できる
 *
 * 使い方:
 *   npx ts-node backend/fix-phone-email-hashes.ts --dry-run   # 確認のみ
 *   npx ts-node backend/fix-phone-email-hashes.ts             # 実行
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const DRY_RUN = process.argv.includes('--dry-run');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * 復号（失敗時は null を返す。暗号文をそのまま返さないこと＝今回の障害の再発防止）
 */
function decryptStrict(encryptedData: string | null): string | null {
  if (!encryptedData) return null;
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== KEY_LENGTH) return null;
  try {
    const buffer = Buffer.from(encryptedData, 'base64');
    if (buffer.length < IV_LENGTH + SALT_LENGTH + TAG_LENGTH) return null;
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const enc = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const d = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'utf-8'), iv);
    d.setAuthTag(tag);
    const out = d.update(enc.toString('hex'), 'hex', 'utf8') + d.final('utf8');
    return out || null;
  } catch {
    return null;
  }
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

async function main() {
  console.log('='.repeat(80));
  console.log(`phone_number_hash / email_hash 修復${DRY_RUN ? '（DRY RUN・更新しません）' : ''}`);
  console.log('='.repeat(80));

  // ── 事前検証: ENCRYPTION_KEY で実際に復号できるか確認 ──────────────
  const { data: probe } = await supabase
    .from('sellers')
    .select('seller_number, phone_number')
    .not('phone_number', 'is', null)
    .limit(20);

  const probeOk = (probe || []).filter((s) => {
    const v = decryptStrict(s.phone_number);
    return !!v && /^[0-9+\-() ]{7,}$/.test(v);
  }).length;

  console.log(`\n復号検証: ${probeOk} / ${probe?.length || 0}件 成功`);
  if (probeOk === 0) {
    console.error('❌ ENCRYPTION_KEY で復号できません。誤ったハッシュを書かないため中断します。');
    process.exit(1);
  }

  // ── 全件走査してハッシュを検証・修復 ──────────────────────────────
  let page = 0;
  const pageSize = 1000;
  let total = 0;
  let phoneFixed = 0;
  let emailFixed = 0;
  let skippedDecryptFail = 0;
  let updateErrors = 0;
  const fixedSamples: string[] = [];

  while (true) {
    const { data: rows, error } = await supabase
      .from('sellers')
      .select('id, seller_number, phone_number, phone_number_hash, email, email_hash')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ 取得エラー:', error.message);
      break;
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      total++;
      const updates: Record<string, string> = {};

      // 電話番号ハッシュ
      if (row.phone_number) {
        const phone = decryptStrict(row.phone_number);
        if (!phone) {
          skippedDecryptFail++;
        } else {
          const correct = sha256(phone);
          if (row.phone_number_hash !== correct) {
            updates.phone_number_hash = correct;
          }
        }
      }

      // メールハッシュ
      if (row.email) {
        const email = decryptStrict(row.email);
        if (email) {
          const correct = sha256(email);
          if (row.email_hash !== correct) {
            updates.email_hash = correct;
          }
        }
      }

      if (Object.keys(updates).length === 0) continue;

      if (updates.phone_number_hash) phoneFixed++;
      if (updates.email_hash) emailFixed++;
      if (fixedSamples.length < 10) fixedSamples.push(row.seller_number);

      if (DRY_RUN) continue;

      // 一時的なネットワークエラーに備えてリトライ
      let ok = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const { error: updateError } = await supabase
            .from('sellers')
            .update(updates)
            .eq('id', row.id);
          if (!updateError) {
            ok = true;
            break;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
      }
      if (!ok) {
        updateErrors++;
        console.error(`❌ ${row.seller_number}: 更新失敗`);
      }
    }

    if (rows.length < pageSize) break;
    page++;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`走査件数                    : ${total}件`);
  console.log(`phone_number_hash 修復${DRY_RUN ? '予定' : '  '}: ${phoneFixed}件`);
  console.log(`email_hash 修復${DRY_RUN ? '予定' : '       '}: ${emailFixed}件`);
  console.log(`復号失敗でスキップ          : ${skippedDecryptFail}件`);
  if (updateErrors > 0) console.log(`更新失敗                    : ${updateErrors}件`);
  console.log('='.repeat(80));
  if (fixedSamples.length > 0) {
    console.log(`対象の例: ${fixedSamples.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
