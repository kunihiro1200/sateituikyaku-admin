/**
 * apply-nta-final.ts
 *
 * 1983〜2011年 115行を国税庁公表値（nta_price）へ本番反映する。
 *
 * 実行方法:
 *   npx ts-node --transpile-only backend/apply-nta-final.ts
 *
 * 実装する要件:
 *   ① 履歴テーブル存在確認
 *   ② 全305行のバックアップ（JSON）
 *   ③ 変更履歴（115行）を history テーブルに記録
 *   ④ 疑似トランザクション（失敗時ロールバック）
 *   ⑤ 115行のNTA値一致検証
 *   ⑥ 190行の無変更確認
 *   ⑨ キャッシュ強制クリア
 *   ⑩ ロールバック手順の案内
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BACKUP_PATH = path.join(__dirname, 'construction_prices_backup.json');

// ─── ① 履歴テーブル存在確認 ─────────────────────────────────────────────────
async function checkHistoryTable(): Promise<boolean> {
  const { error } = await supabase.from('construction_unit_price_history').select('id').limit(1);
  if (error && error.code === 'PGRST205') return false;
  return !error || true;
}

// ─── ② バックアップ（全305行） ───────────────────────────────────────────────
async function backup(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('construction_unit_prices')
    .select('*')
    .order('year').order('structure');
  if (error || !data) throw new Error('バックアップ取得失敗: ' + error?.message);

  fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ バックアップ完了: ${data.length}行 → ${BACKUP_PATH}`);
  return data;
}

// ─── ④ ロールバック（バックアップから復元） ──────────────────────────────────
async function rollback(changedIds: string[]): Promise<void> {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error('❌ バックアップファイルが見つかりません: ' + BACKUP_PATH);
    return;
  }
  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  const toRestore = backup.filter((r: any) => changedIds.includes(r.id));

  console.log(`\n🔄 ロールバック実行中: ${toRestore.length}行を復元します`);
  let restored = 0;
  for (const row of toRestore) {
    const { error } = await supabase
      .from('construction_unit_prices')
      .update({
        price_per_sqm:  row.price_per_sqm,
        price_source:   row.price_source,
        is_provisional: row.is_provisional,
        provisional_reason: row.provisional_reason,
        approved_at:    row.approved_at,
        approved_by:    row.approved_by,
        version:        row.version,
      })
      .eq('id', row.id);
    if (!error) { process.stdout.write('.'); restored++; }
    else console.warn(`\n⚠️ ロールバック失敗 ${row.year}/${row.structure}:`, error.message);
  }
  console.log(`\n✅ ロールバック完了: ${restored}行を元の値に復元しました`);
}

// ─── 計算検証（既存ロジックと同一） ─────────────────────────────────────────
function calcBuildingPrice(unitPrice: number, area: number, age: number, structure: string): number {
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
  return Math.round(base); // RC / SRC: 減価なし
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────
async function main() {
  console.log('===== 建築単価 NTA更新 本番反映スクリプト =====\n');

  // ─ ① 履歴テーブル確認 ─────────────────────────────────────────────────────
  console.log('① 履歴テーブル確認...');
  const historyExists = await checkHistoryTable();
  if (!historyExists) {
    console.error('❌ construction_unit_price_history テーブルが存在しません。');
    console.error('   Supabase SQL Editor で 20261013b_create_construction_price_history.sql を実行してください。');
    process.exit(1);
  }
  console.log('✅ 履歴テーブル確認OK\n');

  // ─ ② バックアップ ──────────────────────────────────────────────────────────
  console.log('② 全305行バックアップ作成...');
  const backupData = await backup();
  const backupMap = new Map<string, any>(backupData.map(r => [r.id as string, r]));
  console.log();

  // ─ 変更対象行の抽出 ────────────────────────────────────────────────────────
  const { data: targets, error: fetchErr } = await supabase
    .from('construction_unit_prices')
    .select('id, year, structure, price_per_sqm, nta_price, is_provisional, version')
    .gte('year', 1983)
    .lte('year', 2011)
    .eq('is_approved', true)
    .neq('structure', '軽量鉄骨')
    .order('year').order('structure');

  if (fetchErr || !targets) throw new Error('変更対象取得失敗: ' + fetchErr?.message);

  const toChange = targets.filter(r => r.nta_price !== null && r.price_per_sqm !== r.nta_price);
  const noChange = targets.filter(r => r.nta_price !== null && r.price_per_sqm === r.nta_price);

  console.log(`③ 変更対象: ${toChange.length}行、変更不要: ${noChange.length}行`);
  if (toChange.length === 0) { console.log('✅ 変更対象なし。終了します。'); return; }

  // ─ ③④ 変更履歴記録 + price_per_sqm 更新（疑似トランザクション） ───────────
  console.log('\n④ 更新開始（疑似トランザクション: エラー時はロールバック）...');
  const appliedIds: string[] = [];
  let errors = 0;
  const now = new Date().toISOString();

  for (const row of toChange) {
    if (!row.nta_price) continue;

    // ─ 履歴を先に記録 ─────────────────────────────────────────────────────
    const { error: histErr } = await supabase
      .from('construction_unit_price_history')
      .insert({
        construction_unit_price_id: row.id,
        year:       row.year,
        structure:  row.structure,
        old_price:  row.price_per_sqm,
        new_price:  row.nta_price,
        source:     'nta',
        reason:     '第5段階: 国税庁「建物の標準的な建築価額表」公表値へ更新（1983〜2011年）',
        applied_by: 'stage5_nta_update',
        applied_at: now,
      });

    if (histErr) {
      console.error(`\n❌ 履歴記録失敗 ${row.year}/${row.structure}:`, histErr.message);
      errors++;
      // ロールバック実行
      await rollback(appliedIds);
      process.exit(1);
    }

    // ─ price_per_sqm 更新 ─────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('construction_unit_prices')
      .update({
        price_per_sqm:      row.nta_price,
        price_source:       'nta',
        is_provisional:     false,
        provisional_reason: null,
        approved_at:        now,
        approved_by:        'stage5_nta_update',
        version:            (row.version ?? 1) + 1,
      })
      .eq('id', row.id);

    if (updateErr) {
      console.error(`\n❌ 更新失敗 ${row.year}/${row.structure}:`, updateErr.message);
      errors++;
      // 失敗した行の履歴を削除し、成功した行をロールバック
      await supabase
        .from('construction_unit_price_history')
        .delete()
        .eq('construction_unit_price_id', row.id)
        .eq('applied_at', now);
      await rollback(appliedIds);
      process.exit(1);
    }

    appliedIds.push(row.id);
    process.stdout.write('.');
  }

  console.log(`\n\n✅ ${appliedIds.length}行の更新完了（エラー: ${errors}件）\n`);

  // ─ ⑤ 115行 NTA一致検証 ──────────────────────────────────────────────────
  console.log('⑤ 更新後のNTA値一致検証...');
  const { data: updated } = await supabase
    .from('construction_unit_prices')
    .select('year, structure, price_per_sqm, nta_price')
    .gte('year', 1983)
    .lte('year', 2011)
    .eq('is_approved', true)
    .neq('structure', '軽量鉄骨')
    .order('year').order('structure');

  let v5Pass = 0; let v5Fail = 0;
  const v5Failures: string[] = [];
  for (const r of (updated ?? [])) {
    if (r.nta_price === null) continue;
    if (r.price_per_sqm === r.nta_price) { v5Pass++; }
    else {
      v5Fail++;
      v5Failures.push(`${r.year}/${r.structure}: price=${r.price_per_sqm} nta=${r.nta_price}`);
    }
  }
  if (v5Fail === 0) {
    console.log(`✅ NTA一致検証 PASS: ${v5Pass}行すべてNTA値と一致`);
  } else {
    console.error(`❌ NTA一致検証 FAIL: ${v5Fail}行で不一致`);
    v5Failures.forEach(f => console.error('  ', f));
  }

  // ─ ⑥ 190行 無変更確認 ───────────────────────────────────────────────────
  console.log('\n⑥ 変更対象外190行の無変更確認...');
  const { data: unchanged } = await supabase
    .from('construction_unit_prices')
    .select('id, year, structure, price_per_sqm')
    .or('year.lt.1983,year.gt.2011,structure.eq.軽量鉄骨')
    .eq('is_approved', true)
    .order('year');

  let v6Pass = 0; let v6Fail = 0;
  for (const r of (unchanged ?? [])) {
    const orig = backupMap.get(r.id as string);
    if (!orig) continue;
    if (r.price_per_sqm === orig.price_per_sqm) { v6Pass++; }
    else {
      v6Fail++;
      console.error(`  ❌ 意図しない変更: ${r.year}/${r.structure}: ${orig.price_per_sqm}→${r.price_per_sqm}`);
    }
  }
  if (v6Fail === 0) {
    console.log(`✅ 無変更確認 PASS: ${v6Pass}行すべて変更なし`);
  } else {
    console.error(`❌ 意図しない変更 ${v6Fail}件`);
  }

  // ─ ⑨ キャッシュ強制クリア ────────────────────────────────────────────────
  console.log('\n⑨ キャッシュ強制クリア...');
  const backendUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
  const cronSecret = process.env.CRON_SECRET ?? '';

  if (backendUrl) {
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post(`${backendUrl}/api/construction-prices/invalidate-cache`, {}, {
        headers: { 'x-cron-secret': cronSecret },
        timeout: 10000,
      });
      console.log('✅ キャッシュクリア完了:', res.data);
    } catch (e: any) {
      console.warn('⚠️ キャッシュクリアAPI呼び出し失敗（TTL 6h後に自動更新されます）:', e.message);
    }
  } else {
    console.log('⚠️ BACKEND_URL 未設定。キャッシュは TTL 6h 後に自動更新されます。');
  }

  // ─ 建物査定計算の整合性確認テスト ─────────────────────────────────────────
  console.log('\n⑦ 查定計算整合性テスト（代表ケース）...');
  const testCases = [
    { yr: 1990, st: '鉄骨', area: 100, expectedNTA: 147400 },
    { yr: 1990, st: '鉄筋コンクリート', area: 80, expectedNTA: 222900 },
    { yr: 2001, st: '鉄筋コンクリート', area: 80, expectedNTA: 177800 },
    { yr: 2010, st: '木造', area: 100, expectedNTA: 156500 },
  ];
  const currentYear = new Date().getFullYear();
  const { data: testData } = await supabase
    .from('construction_unit_prices')
    .select('year, structure, price_per_sqm')
    .in('year', testCases.map(t => t.yr))
    .eq('is_approved', true);

  for (const tc of testCases) {
    const row = (testData ?? []).find(r => r.year === tc.yr && r.structure === tc.st);
    if (!row) { console.warn(`  ⚠️ ${tc.yr}/${tc.st}: DB行なし`); continue; }
    const age = currentYear - tc.yr;
    const price = calcBuildingPrice(row.price_per_sqm, tc.area, age, tc.st === '鉄筋コンクリート' ? 'RC' : tc.st);
    const pricePrev = calcBuildingPrice(tc.expectedNTA, tc.area, age, tc.st === '鉄筋コンクリート' ? 'RC' : tc.st);
    const ok = row.price_per_sqm === tc.expectedNTA;
    console.log(`  ${ok ? '✅' : '❌'} ${tc.yr}年${tc.st}: 単価=${row.price_per_sqm.toLocaleString()} 建物価格=${Math.round(price/10000)}万円`);
  }

  // ─ 完了報告 ────────────────────────────────────────────────────────────────
  console.log('\n===== 本番反映完了 =====');
  console.log(`更新: ${appliedIds.length}行 / NTA一致検証: ${v5Pass}行PASS ${v5Fail}行FAIL / 無変更確認: ${v6Pass}行PASS ${v6Fail}行FAIL`);
  console.log('\nバックアップ:', BACKUP_PATH);
  console.log('\n⑩ ロールバック方法:');
  console.log('  npx ts-node --transpile-only backend/rollback-nta-update.ts');
}

main().catch(e => {
  console.error('\n❌ 予期しないエラー:', e.message);
  process.exit(1);
});
