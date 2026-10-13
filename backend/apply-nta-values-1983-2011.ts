/**
 * apply-nta-values-1983-2011.ts
 *
 * 1983〜2011年の116行（4構造）について、現行ハードコード値を
 * 国税庁「建物の標準的な建築価額表」の公式公表値（nta_price）に更新する。
 *
 * 実行方法:
 *   # dry-run（変更内容の確認のみ・DBに書き込まない）
 *   npx ts-node --transpile-only backend/apply-nta-values-1983-2011.ts --dry-run
 *
 *   # 本番反映（承認後に実行）
 *   npx ts-node --transpile-only backend/apply-nta-values-1983-2011.ts
 *
 * 処理内容:
 *   1. DB から 1983〜2011年の全行を取得（nta_price・price_per_sqm）
 *   2. 差がある行（>= 1円）を変更候補に抽出
 *   3. construction_unit_price_history に変更前後を記録
 *   4. price_per_sqm = nta_price に更新
 *   5. price_source = 'nta', is_provisional = false に更新
 *
 * 変更対象外:
 *   - 軽量鉄骨（係数1.0維持・今回は変更しない）
 *   - 1965〜1982年（既にNTAと一致）
 *   - 2012〜2025年（既にNTAと一致）
 *   - 減価率・査定ロジック（一切変更しない）
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes('--dry-run');

// ─── 計算ロジック（ValuationCalculatorService と同じ） ────────────────────────
// ⚠️ 減価率・耐用年数・計算式は変更しない
function calcBuildingPrice(
  unitPrice: number,
  area: number,
  age: number,
  structure: string
): number {
  const base = unitPrice * area;
  if (structure === '木造' || !structure) {
    if (age >= 33) return Math.round(base * 0.1);
    return Math.round(base - base * 0.9 * age * 0.031);
  } else if (structure === '鉄骨') {
    if (age >= 40) return Math.round(base * 0.1);
    return Math.round(base - base * 0.9 * age * 0.015);
  } else if (structure === '軽量鉄骨') {
    if (age >= 40) return Math.round(base * 0.1);
    return Math.round(base - base * 0.9 * age * 0.025);
  }
  // RC / SRC: 減価なし
  return Math.round(base);
}

// ─── テストケース定義 ─────────────────────────────────────────────────────────
interface TestCase {
  buildYear: number;
  structure: string;
  area: number;
  label: string;
}
const TEST_CASES: TestCase[] = [
  // バブル期（上昇方向）
  { buildYear: 1990, structure: '木造',                 area: 100, label: '1990年築 木造 100㎡' },
  { buildYear: 1990, structure: '鉄骨',                 area: 100, label: '1990年築 鉄骨 100㎡' },
  { buildYear: 1990, structure: '鉄筋コンクリート',     area: 80,  label: '1990年築 RC 80㎡' },
  { buildYear: 1990, structure: '鉄骨鉄筋コンクリート', area: 80,  label: '1990年築 SRC 80㎡' },
  // 2000年代（下降方向）
  { buildYear: 2001, structure: '鉄筋コンクリート',     area: 80,  label: '2001年築 RC 80㎡' },
  { buildYear: 2001, structure: '鉄骨鉄筋コンクリート', area: 80,  label: '2001年築 SRC 80㎡' },
  // 中間
  { buildYear: 1995, structure: '木造',                 area: 100, label: '1995年築 木造 100㎡' },
  { buildYear: 2005, structure: '木造',                 area: 100, label: '2005年築 木造 100㎡' },
  { buildYear: 2010, structure: '木造',                 area: 100, label: '2010年築 木造 100㎡' },
  { buildYear: 2010, structure: '鉄骨',                 area: 100, label: '2010年築 鉄骨 100㎡' },
  { buildYear: 2010, structure: '鉄筋コンクリート',     area: 80,  label: '2010年築 RC 80㎡' },
];

// ─── メイン処理 ──────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY-RUN モード（DBへの書き込みなし）'
    : '⚠️  本番反映モード（DB を更新します）'
  );

  // 1) DB から 1983〜2011年の全行（軽量鉄骨を除く）を取得
  const { data: rows, error } = await supabase
    .from('construction_unit_prices')
    .select('id, year, structure, price_per_sqm, nta_price, price_source, is_provisional')
    .gte('year', 1983)
    .lte('year', 2011)
    .eq('is_approved', true)
    .neq('structure', '軽量鉄骨')  // 軽量鉄骨は今回変更しない
    .order('year')
    .order('structure');

  if (error || !rows) {
    console.error('DB取得エラー:', error?.message);
    process.exit(1);
  }

  console.log(`\n📊 取得行数: ${rows.length}行（軽量鉄骨を除く 1983〜2011年）`);

  // 2) 変更が必要な行を抽出（nta_price が存在し、price_per_sqm と異なる行）
  const toChange = rows.filter(r =>
    r.nta_price !== null &&
    r.nta_price !== undefined &&
    r.price_per_sqm !== r.nta_price
  );
  const noChange = rows.filter(r =>
    r.nta_price !== null && r.price_per_sqm === r.nta_price
  );

  console.log(`✅ 変更不要（既にNTA一致）: ${noChange.length}行`);
  console.log(`🔄 変更対象（NTA値に更新）: ${toChange.length}行\n`);

  // 3) 変更内容の詳細表示
  const currentYear = new Date().getFullYear();

  console.log('=== 変更一覧 ===');
  console.log('年  | 構造             | 現在値   | NTA値    | 差額     | 変動率');
  console.log('----+-----------------+---------+---------+---------+------');

  let totalOldPrice = 0;
  let totalNewPrice = 0;

  for (const row of toChange) {
    const diff = row.nta_price - row.price_per_sqm;
    const pct  = ((diff / row.price_per_sqm) * 100).toFixed(1);
    const structShort = row.structure.length > 10 ? row.structure.substring(0, 10) : row.structure.padEnd(10);
    console.log(
      `${row.year} | ${structShort.padEnd(17)} | ${String(row.price_per_sqm).padStart(8)} | ` +
      `${String(row.nta_price).padStart(8)} | ${(diff >= 0 ? '+' : '') + diff.toLocaleString().padStart(7)} | ` +
      `${diff >= 0 ? '+' : ''}${pct}%`
    );
    totalOldPrice += row.price_per_sqm;
    totalNewPrice += row.nta_price;
  }

  console.log(`\n合計 ${toChange.length}行 | 現在値合計: ${totalOldPrice.toLocaleString()} | NTA値合計: ${totalNewPrice.toLocaleString()}`);

  // 4) 計算検証テスト
  console.log('\n=== 計算検証テスト ===');
  console.log('テストケース | 現在単価→NTA単価 | 現在建物価→NTA建物価 | 差額（万円）| 変動率');

  const testMap = new Map<string, { old: number; nta: number }>();
  rows.forEach(r => testMap.set(`${r.year}-${r.structure}`, { old: r.price_per_sqm, nta: r.nta_price ?? r.price_per_sqm }));

  let testPassed = 0;
  let testFailed = 0;

  for (const tc of TEST_CASES) {
    const key = `${tc.buildYear}-${tc.structure}`;
    const prices = testMap.get(key);
    if (!prices) { console.log(`  ${tc.label}: データなし`); continue; }

    const age = currentYear - tc.buildYear;
    const oldVal = calcBuildingPrice(prices.old, tc.area, age, tc.structure);
    const newVal = calcBuildingPrice(prices.nta, tc.area, age, tc.structure);
    const diffMan = Math.round((newVal - oldVal) / 10000);
    const pct = ((newVal - oldVal) / oldVal * 100).toFixed(1);

    // 検証: 単価が正の値で、計算結果が正の値であること
    const ok = prices.nta > 0 && newVal > 0 && newVal !== oldVal;
    if (ok) testPassed++; else testFailed++;

    console.log(
      `  ${ok ? '✅' : '❌'} ${tc.label}: ` +
      `${prices.old.toLocaleString()}→${prices.nta.toLocaleString()}円/m² | ` +
      `${Math.round(oldVal/10000)}万→${Math.round(newVal/10000)}万 | ` +
      `${diffMan >= 0 ? '+' : ''}${diffMan}万 (${diffMan >= 0 ? '+' : ''}${pct}%)`
    );
  }

  console.log(`\n計算テスト: ${testPassed}件 PASS / ${testFailed}件 FAIL`);

  if (testFailed > 0) {
    console.error('\n❌ テスト失敗。本番反映を中止します。');
    process.exit(1);
  }

  // 5) サマリー確認
  console.log('\n=== 最終サマリー ===');
  console.log(`変更対象: ${toChange.length}行`);

  const byStruct: Record<string, number> = {};
  toChange.forEach(r => { byStruct[r.structure] = (byStruct[r.structure] || 0) + 1; });
  Object.entries(byStruct).forEach(([s, c]) => console.log(`  ${s}: ${c}行`));

  const bigChanges = toChange.filter(r => r.nta_price !== null && Math.abs(r.nta_price - r.price_per_sqm) > 20000);
  console.log(`\n変動率 >±10% の行: ${bigChanges.length}行（主にバブル期のRC/SRC）`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY-RUN 完了。--dry-run なしで再実行すると DB に反映されます。');
    return;
  }

  // 6) 本番反映（--dry-run なし の場合のみ）
  console.log('\n🚀 DB 更新を開始します...');
  let applied = 0;
  let errors  = 0;

  for (const row of toChange) {
    if (!row.nta_price) continue;

    // 変更履歴を記録
    const { error: histError } = await supabase
      .from('construction_unit_price_history')
      .insert({
        construction_unit_price_id: row.id,
        year:       row.year,
        structure:  row.structure,
        old_price:  row.price_per_sqm,
        new_price:  row.nta_price,
        source:     'nta',
        reason:     '1983〜2011年の建築単価を国税庁「建物の標準的な建築価額表」公表値へ更新（第5段階）',
        applied_by: 'migration_stage5',
        applied_at: new Date().toISOString(),
      });

    if (histError) {
      console.warn(`⚠️ 履歴記録失敗 ${row.year}/${row.structure}:`, histError.message);
    }

    // price_per_sqm を更新
    const { error: updateError } = await supabase
      .from('construction_unit_prices')
      .update({
        price_per_sqm:     row.nta_price,
        price_source:      'nta',
        is_provisional:    false,
        provisional_reason: null,
        approved_at:       new Date().toISOString(),
        approved_by:       'stage5_nta_update',
        version:           (row as any).version + 1,
      })
      .eq('id', row.id);

    if (updateError) {
      console.error(`❌ 更新失敗 ${row.year}/${row.structure}:`, updateError.message);
      errors++;
    } else {
      process.stdout.write('.');
      applied++;
    }
  }

  console.log(`\n\n✅ 完了: ${applied}行 更新 / ${errors}行 エラー`);

  if (errors === 0) {
    console.log('\n📋 次のステップ:');
    console.log('  1. ValuationCalculatorService のキャッシュが TTL(6h) 後に自動更新されます');
    console.log('  2. 変更履歴は construction_unit_price_history テーブルで確認できます');
    console.log('  3. 軽量鉄骨（係数1.0維持）は今回変更していません');
  }
}

main().catch(e => {
  console.error('❌ 予期しないエラー:', e);
  process.exit(1);
});
