/**
 * 生きている売主の重複状況を分析（読み取りのみ・更新しない）
 *
 * 同一電話番号（phone_number_hash）でグループ化し、以下に分類する：
 *   A) 反響日時も同一 → エラー重複（同じメールの二重処理）＝削除候補
 *   B) 反響日時が違う → 正常な再問い合わせ（別時期の依頼）＝残して重複ボタンで確認したい対象
 *
 * 使い方: npx ts-node backend/check-duplicate-groups.ts
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

const dtKey = (v: string | null): string => (v ? String(v).replace(' ', 'T').substring(0, 19) : '');

async function main() {
  console.log('='.repeat(80));
  console.log('生きている売主の重複状況（読み取りのみ）');
  console.log('='.repeat(80));

  // 生きているレコードを全件取得
  let page = 0;
  const pageSize = 1000;
  const rows: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, name, phone_number, phone_number_hash, inquiry_date, inquiry_detailed_datetime, inquiry_site, status, created_at')
      .is('deleted_at', null)
      .not('phone_number_hash', 'is', null)
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('取得エラー:', error.message);
      return;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n対象レコード（生存・ハッシュあり）: ${rows.length}件`);

  // ⚠️ 除外1: プレースホルダー電話番号
  // 「不可」「メールのみ」などの固定文字列は全員同じハッシュになるため、
  // 別人同士が「同一電話番号」と誤判定される。重複判定から除外する。
  const placeholderGroups = new Map<string, any[]>();
  const validRows: any[] = [];
  for (const r of rows) {
    const phone = decrypt(r.phone_number);
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 10) {
      // 電話番号として成立しない値（不可 / メールのみ / 空 など）
      const list = placeholderGroups.get(r.phone_number_hash) || [];
      list.push({ ...r, _phone: phone });
      placeholderGroups.set(r.phone_number_hash, list);
    } else {
      validRows.push({ ...r, _phone: phone });
    }
  }

  const placeholderMulti = Array.from(placeholderGroups.entries()).filter(([, l]) => l.length > 1);
  console.log(`\n⚠️ プレースホルダー電話番号（重複判定から除外）: ${placeholderMulti.length}種類`);
  for (const [, list] of placeholderMulti.sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
    console.log(`   "${list[0]._phone}" → ${list.length}件が同一ハッシュ（別人同士）`);
  }

  // 電話番号ハッシュでグループ化（有効な電話番号のみ）
  const groups = new Map<string, any[]>();
  for (const r of validRows) {
    const list = groups.get(r.phone_number_hash) || [];
    list.push(r);
    groups.set(r.phone_number_hash, list);
  }

  const multi = Array.from(groups.entries()).filter(([, list]) => list.length > 1);

  // A) 反響日時が同一のペアを含むグループ = エラー重複
  const errorGroups: any[][] = [];
  // B) 反響日時が全て異なるグループ = 正常な再問い合わせ
  const legitGroups: any[][] = [];
  // C) 反響日時が未記録（null）で判別できないグループ = 手動確認が必要
  const unknownGroups: any[][] = [];

  for (const [, list] of multi) {
    // ⚠️ 除外2: 反響日時がnullのものは「同一」と断定できない
    //    （古いレコードは反響詳細日時が未記録のため、null同士を同一扱いにしてはいけない）
    const withDt = list.filter((r) => !!r.inquiry_detailed_datetime);
    const keys = withDt.map((r) => dtKey(r.inquiry_detailed_datetime));
    const hasSameDatetime = new Set(keys).size < keys.length;

    if (hasSameDatetime) {
      errorGroups.push(list);
    } else if (withDt.length < list.length) {
      // 反響日時が欠けているレコードを含む → 自動判定不可
      unknownGroups.push(list);
    } else {
      legitGroups.push(list);
    }
  }

  console.log(`\n有効な電話番号での同一グループ: ${multi.length}組`);
  console.log(`  A) 反響日時も完全一致（エラー重複・削除候補）: ${errorGroups.length}組`);
  console.log(`  B) 反響日時が全て異なる（正常な再問い合わせ・残す）: ${legitGroups.length}組`);
  console.log(`  C) 反響日時が未記録で判別不可（手動確認）: ${unknownGroups.length}組`);

  // A の詳細
  if (errorGroups.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('【A】エラー重複（同一電話番号 + 同一反響日時）= 削除候補');
    console.log('-'.repeat(80));
    let extraCount = 0;
    for (const list of errorGroups.slice(0, 15)) {
      const phone = decrypt(list[0].phone_number);
      console.log(`\n電話 ${phone} （${list.length}件）`);
      for (const r of list.sort((a, b) => a.seller_number.localeCompare(b.seller_number))) {
        console.log(`  ${r.seller_number.padEnd(9)} | ${decrypt(r.name).padEnd(12)} | 反響日時=${r.inquiry_detailed_datetime} | site=${r.inquiry_site} | ${r.status}`);
      }
    }
    for (const list of errorGroups) {
      const byDt = new Map<string, any[]>();
      for (const r of list.filter((x) => !!x.inquiry_detailed_datetime)) {
        const k = dtKey(r.inquiry_detailed_datetime);
        byDt.set(k, [...(byDt.get(k) || []), r]);
      }
      for (const [, same] of byDt) {
        if (same.length > 1) extraCount += same.length - 1;
      }
    }
    if (errorGroups.length > 15) console.log(`\n... 他 ${errorGroups.length - 15}組`);
    console.log(`\n→ 1件だけ残して削除すべき余剰レコード: ${extraCount}件`);
  }

  // B の詳細
  if (legitGroups.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('【B】正常な再問い合わせ（同一電話番号 + 反響日時が違う）= 残す・重複ボタン対象');
    console.log('-'.repeat(80));
    for (const list of legitGroups.slice(0, 15)) {
      const phone = decrypt(list[0].phone_number);
      const sorted = list.sort((a, b) => dtKey(a.inquiry_detailed_datetime).localeCompare(dtKey(b.inquiry_detailed_datetime)));
      const span = sorted.map((r) => (r.inquiry_detailed_datetime || r.inquiry_date || '?').toString().substring(0, 10));
      console.log(`\n電話 ${phone} （${list.length}件） 反響: ${span.join(' → ')}`);
      for (const r of sorted) {
        console.log(`  ${r.seller_number.padEnd(9)} | ${decrypt(r.name).padEnd(12)} | ${r.inquiry_detailed_datetime || r.inquiry_date} | site=${r.inquiry_site} | ${r.status}`);
      }
    }
    if (legitGroups.length > 15) console.log(`\n... 他 ${legitGroups.length - 15}組`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
