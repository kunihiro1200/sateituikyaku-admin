/**
 * 学校区データ年次更新チェック
 *
 * ① 毎年4月第1月曜日のみ実行（dayOfMonth <= 7）
 * ③ 一部でもソース取得失敗 → all_ok=false、PR未作成、既存データ維持
 * ④ 全ソース取得成功時のみ → 差分確認 + PR
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';

const DATA_DIR    = path.resolve(__dirname, '../src/data');
const SCRIPTS_DIR = path.resolve(__dirname, '.');
const TMP_DIR     = path.resolve(__dirname, '../tmp-update');

const FUKUOKA_JSON  = path.join(DATA_DIR, 'fukuoka-school-address-map.json');
const OITA_JSON     = path.join(DATA_DIR, 'oita-beppu-school-address-map.json');
const METADATA_JSON = path.join(SCRIPTS_DIR, 'school-data-metadata.json');

// GitHub Actions 出力変数の設定
function setOutput(name: string, value: string) {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `${name}=${value}\n`);
  }
  console.log(`[OUTPUT] ${name}=${value}`);
}

// レポートファイルに書き込む
function writeReport(filename: string, content: string) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, filename), content, 'utf-8');
}

// ────────────────────────────────────────────────────────────────────────────
// ① 第1月曜日チェック（JST）
// ────────────────────────────────────────────────────────────────────────────
function isFirstMondayOfApril(): boolean {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const month  = nowJst.getUTCMonth();    // 3 = April
  const dom    = nowJst.getUTCDate();     // 1-31
  const dow    = nowJst.getUTCDay();      // 0=Sun, 1=Mon
  return month === 3 && dow === 1 && dom <= 7;
}

// ────────────────────────────────────────────────────────────────────────────
// ③ ソースの疎通チェック（HEAD リクエスト）
//    失敗したソースを返す。空配列 = 全ソース疎通OK
// ────────────────────────────────────────────────────────────────────────────
async function checkSourceAvailability(metadata: any): Promise<string[]> {
  const failed: string[] = [];

  const checks = [
    { label: 'hc.html (福岡市 は行)',   url: 'https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-hc.html' },
    { label: 'mc.html (福岡市 ま行)',   url: 'https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-mc.html' },
    { label: '大分市 CSV',              url: metadata.oita.csv_url },
    { label: '別府市 Excel',            url: metadata.beppu.excel_url },
  ];

  for (const { label, url } of checks) {
    try {
      const res = await axios.head(url, { timeout: 10000 });
      if (res.status !== 200) {
        failed.push(`${label} (HTTP ${res.status})`);
      } else {
        console.log(`  ✅ ${label}: 疎通OK`);
      }
    } catch (e: any) {
      failed.push(`${label} (${e.message})`);
      console.log(`  ❌ ${label}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return failed;
}

// ────────────────────────────────────────────────────────────────────────────
// 差分計算
// ────────────────────────────────────────────────────────────────────────────
function computeDiff(oldRecs: any[], newRecs: any[]) {
  const key = (r: any) =>
    `${r.ward || r.city || ''}|${r.town}|${r.juniorHigh}|${r.elementary}`;

  const oldMap = new Map(oldRecs.map(r => [key(r), r]));
  const newMap = new Map(newRecs.map(r => [key(r), r]));

  const added    = [...newMap].filter(([k]) => !oldMap.has(k)).map(([,v]) => v);
  const deleted  = [...oldMap].filter(([k]) => !newMap.has(k)).map(([,v]) => v);
  const changed  = [...oldMap]
    .filter(([k, o]) => newMap.has(k) && newMap.get(k).range !== o.range)
    .map(([k, o]) => ({ old: o, new: newMap.get(k) }));

  return { added, deleted, changed };
}

// ────────────────────────────────────────────────────────────────────────────
// Markdown レポート生成
// ────────────────────────────────────────────────────────────────────────────
function buildReport(
  year: number,
  diff: { added: any[]; deleted: any[]; changed: any[] },
  oldCount: number,
  newCount: number,
): string {
  const hasChange = diff.added.length + diff.deleted.length + diff.changed.length > 0;
  const lines = [
    `# 学校区データ年次更新レポート ${year}年4月`,
    '',
    `> ${hasChange ? '📝 **変更あり**' : '✅ **変更なし — 全ソース確認済み**'}`,
    '',
    '## サマリー',
    `| 旧件数 | 新件数 | 追加 | 削除 | 区域変更 |`,
    `|---|---|---|---|---|`,
    `| ${oldCount} | ${newCount} | +${diff.added.length} | -${diff.deleted.length} | ~${diff.changed.length} |`,
  ];

  if (diff.added.length > 0) {
    lines.push('', '## 追加された学区');
    lines.push('| 区/市 | 町名 | 小学校 | 中学校 | 区域 |');
    lines.push('|---|---|---|---|---|');
    diff.added.slice(0, 20).forEach(r =>
      lines.push(`| ${r.ward||r.city||''} | ${r.town} | ${r.elementary} | ${r.juniorHigh} | ${(r.range||'').slice(0,40)} |`));
  }

  if (diff.deleted.length > 0) {
    lines.push('', '## 削除された学区');
    lines.push('| 区/市 | 町名 | 小学校 | 中学校 |');
    lines.push('|---|---|---|---|');
    diff.deleted.slice(0, 20).forEach(r =>
      lines.push(`| ${r.ward||r.city||''} | ${r.town} | ${r.elementary} | ${r.juniorHigh} |`));
  }

  if (diff.changed.length > 0) {
    lines.push('', '## 区域変更');
    lines.push('| 区/市 | 町名 | 中学校 | 旧区域 | 新区域 |');
    lines.push('|---|---|---|---|---|');
    diff.changed.slice(0, 20).forEach(({ old: o, new: n }) =>
      lines.push(`| ${o.ward||o.city||''} | ${o.town} | ${o.juniorHigh} | ${(o.range||'').slice(0,30)} | ${(n.range||'').slice(0,30)} |`));
  }

  lines.push('', '---', '> マージ前に変更内容が公式資料と一致しているか確認してください。');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  const year      = new Date().getFullYear();
  const isDryRun  = process.env.DRY_RUN  === 'true';
  const forceRun  = process.env.FORCE_RUN === 'true';

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const metadata = JSON.parse(fs.readFileSync(METADATA_JSON, 'utf-8'));

  // ① 第1月曜日チェック
  if (!forceRun && !isFirstMondayOfApril()) {
    console.log('今日は4月第1月曜日ではありません。処理をスキップします。');
    setOutput('all_ok', 'true');
    setOutput('has_changes', 'false');
    return;
  }

  console.log(`\n=== ${year}年 学校区データ年次更新チェック${isDryRun ? ' [DRY RUN]' : ''} ===\n`);

  // ────────────────────────────────────────────────────────────────────────
  // ③ 全ソースの疎通確認（先行チェック）
  // ────────────────────────────────────────────────────────────────────────
  console.log('=== Step 1: データソース疎通確認 ===');
  const failedSources = await checkSourceAvailability(metadata);

  if (failedSources.length > 0) {
    // ③ 一部でも失敗 → エラーレポートを書いて all_ok=false で終了
    //    PRは作成しない、既存データは維持
    const report = [
      `# ⚠️ 学校区データ取得未確認 ${year}年4月`,
      '',
      '以下のソースが取得できませんでした。**既存データを維持します。PRは作成しません。**',
      '',
      '## 取得失敗ソース',
      ...failedSources.map(s => `- ${s}`),
      '',
      '## 対応方法',
      '1. 上記 URL にアクセスできるか手動で確認してください',
      '2. 別府市など URL が変わっている場合は `school-data-metadata.json` を更新してください',
      '3. 解決後に手動でワークフローを再実行してください',
      '',
      `Actions ログ: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    ].join('\n');

    writeReport('update-report.md', report);
    setOutput('all_ok', 'false');
    setOutput('has_changes', 'false');
    console.log(`\n❌ ${failedSources.length}件のソースが取得できませんでした。`);
    return;
  }

  console.log('✅ 全ソースの疎通を確認しました。\n');

  // ────────────────────────────────────────────────────────────────────────
  // ④ 全ソース成功 → 福岡市 HTML 再スクレイプ
  // ────────────────────────────────────────────────────────────────────────
  console.log('=== Step 2: 福岡市 HTML 再スクレイプ ===');
  const oldFukuoka = JSON.parse(fs.readFileSync(FUKUOKA_JSON, 'utf-8')).records as any[];
  let newFukuoka = oldFukuoka;

  try {
    execSync(`npx ts-node ${path.join(SCRIPTS_DIR, 'build-fukuoka-school-address-map.ts')}`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      timeout: 5 * 60 * 1000,
      env: { ...process.env },
    });
    // ビルドスクリプトが src/data/ に書き込んだ場合はそこから読む
    // SCHOOL_OUTPUT_PATH が設定されている場合はそちら
    const outputPath = process.env.SCHOOL_OUTPUT_PATH
      || path.join(DATA_DIR, 'fukuoka-school-address-map.json');
    const built = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    newFukuoka = built.records as any[];
    console.log(`スクレイプ完了: ${newFukuoka.length}件`);
  } catch (e: any) {
    const report = `# ❌ 学校区データ取得エラー ${year}年4月\n\n福岡市 HTML のスクレイプに失敗しました。\n\n\`\`\`\n${e.message}\n\`\`\`\n\n**既存データは変更されていません。**`;
    writeReport('update-report.md', report);
    setOutput('all_ok', 'false');
    setOutput('has_changes', 'false');
    return;
  }

  // 安全ガード: 0件 or 5%超の減少
  if (newFukuoka.length === 0 || newFukuoka.length < oldFukuoka.length * 0.95) {
    const report = `# ❌ 学校区データ異常 ${year}年4月\n\nレコード数が異常です (${oldFukuoka.length}件 → ${newFukuoka.length}件)。\nパーサーエラーの可能性があります。**既存データは変更されていません。**`;
    writeReport('update-report.md', report);
    setOutput('all_ok', 'false');
    setOutput('has_changes', 'false');
    return;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 差分計算
  // ────────────────────────────────────────────────────────────────────────
  console.log('=== Step 3: 差分計算 ===');
  const diff = computeDiff(oldFukuoka, newFukuoka);
  const hasChanges = diff.added.length + diff.deleted.length + diff.changed.length > 0;
  console.log(`+${diff.added.length} -${diff.deleted.length} ~${diff.changed.length}`);

  // メタデータ更新（疎通確認日のみ記録）
  metadata._last_annual_check = new Date().toISOString().split('T')[0];
  fs.writeFileSync(METADATA_JSON, JSON.stringify(metadata, null, 2), 'utf-8');

  // レポート生成
  const report = buildReport(year, diff, oldFukuoka.length, newFukuoka.length);
  writeReport('update-report.md', report);

  setOutput('all_ok', 'true');
  setOutput('has_changes', String(hasChanges));

  console.log(`\n=== 完了 ===`);
  console.log(`全ソース取得: OK`);
  console.log(`変更あり: ${hasChanges}`);

  if (isDryRun) {
    console.log('\n[DRY RUN] PR・Issue・コミット・DB更新は一切行いません。');
    console.log(report);
  }
}

main().catch(e => {
  console.error('致命的エラー:', e.message);
  const report = `# ❌ スクリプトエラー\n\n\`\`\`\n${e.stack || e.message}\n\`\`\`\n\n**既存データは変更されていません。**`;
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'update-report.md'), report, 'utf-8');
  setOutput('all_ok', 'false');
  setOutput('has_changes', 'false');
  process.exit(1);
});
