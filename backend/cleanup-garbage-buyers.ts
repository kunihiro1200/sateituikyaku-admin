/**
 * 買主リストに混入したゴミレコードを削除するスクリプト
 *
 * 症状（2026年9〜10月）:
 *   スプレッドシート同期時に列が1つズレ、以下のような壊れたレコードが混入した。
 *     - buyer_number: ハッシュ文字列（例 "23bd565acf4k"）や JS Date 文字列
 *     - name: JavaScript の Date を文字列化したもの
 *       （例 "Mon Sep 14 2026 00:00:00 GMT+0900 (Japan Standard Time)"）
 *     - reception_date: 1923年など異常な年、または誤って正常年に見える値
 *
 * 判定条件（以下のいずれか = OR）:
 *   パターンA（氏名にDateが流れ込んだケース）:
 *     - name が JS Date の toString パターン（曜日略称 + ... + GMT）
 *     - かつ buyer_number が「数値のみ」でも「FK+数値」でもない
 *   パターンB（買主番号にDateが流れ込んだケース・スクショ1件目の冨高江理など）:
 *     - buyer_number 自体が JS Date の toString パターン
 *
 * これらだけを対象にすることで、
 * AA系の正常データ・テストデータ・通常の買主を巻き込まない。
 *
 * 既存の delete-buyer-30899b7105fi.ts と同じく物理削除する。
 *
 * 使い方:
 *   npx ts-node cleanup-garbage-buyers.ts            # ドライラン（削除しない・対象表示のみ）
 *   npx ts-node cleanup-garbage-buyers.ts --execute  # 実際に削除
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const EXECUTE = process.argv.includes('--execute');

// JS Date の toString パターン: "Mon Sep 14 2026 00:00:00 GMT+0900 (...)"
const JS_DATE_NAME = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT/;

const isValidBuyerNumber = (bn: any): boolean => {
  if (bn === null || bn === undefined) return false;
  const s = String(bn).trim();
  return /^\d+$/.test(s) || /^FK\d+$/.test(s);
};

async function main() {
  console.log(`=== ゴミ買主レコードのクリーンアップ（${EXECUTE ? '実行モード' : 'ドライラン'}） ===\n`);

  // 全件取得（判定に必要なカラムのみ）
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, reception_date, created_datetime, property_number, last_synced_at')
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('取得エラー:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`総買主レコード数: ${all.length}`);

  // パターンA または パターンB に該当するものを対象
  const targets = all.filter(b => {
    const nameLooksLikeDate = typeof b.name === 'string' && JS_DATE_NAME.test(b.name.trim());
    const buyerNumberLooksLikeDate = typeof b.buyer_number === 'string' && JS_DATE_NAME.test(String(b.buyer_number).trim());
    const badBuyerNumber = !isValidBuyerNumber(b.buyer_number);
    // パターンA: 氏名がDate かつ 買主番号が不正
    const patternA = nameLooksLikeDate && badBuyerNumber;
    // パターンB: 買主番号自体がDate文字列
    const patternB = buyerNumberLooksLikeDate;
    return patternA || patternB;
  });

  console.log(`\n削除対象（name=Date または buyer_number=Date のゴミ）: ${targets.length}件\n`);
  targets.forEach(b => {
    console.log(
      `- buyer_number="${b.buyer_number}" | reception_date=${b.reception_date} | name="${b.name}" | synced=${b.last_synced_at ?? ''}`
    );
  });

  if (targets.length === 0) {
    console.log('\n対象なし。削除不要です。');
    return;
  }

  if (!EXECUTE) {
    console.log('\n--- ドライランのため削除していません。実行するには --execute を付けてください。 ---');
    return;
  }

  // 物理削除（buyer_number をキーに1件ずつ）
  let deleted = 0;
  for (const b of targets) {
    const { error } = await supabase
      .from('buyers')
      .delete()
      .eq('buyer_number', b.buyer_number);
    if (error) {
      console.error(`削除エラー buyer_number="${b.buyer_number}":`, error.message);
    } else {
      deleted++;
    }
  }

  console.log(`\n✅ ${deleted}/${targets.length}件を削除しました。`);

  // 残っていないか再確認
  const { data: remaining } = await supabase
    .from('buyers')
    .select('buyer_number, name')
    .in('buyer_number', targets.map(t => t.buyer_number));
  if (remaining && remaining.length > 0) {
    console.log('\n⚠️ 削除後も残っているレコード:');
    console.log(JSON.stringify(remaining, null, 2));
  } else {
    console.log('残存チェック: すべて削除済み。');
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
