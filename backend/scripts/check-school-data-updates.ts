/**
 * 学校区データ年次更新チェックスクリプト
 *
 * 1. 福岡市 HTML ページ（ライブ + Wayback Machine）を再取得
 * 2. 大分市 CSV・別府市 Excel を確認
 * 3. 現行 JSON と差分を計算（⑤ 1件でも変化があれば記録）
 * 4. Markdown レポートを生成（PR 本文に使用）
 * 5. GitHub Actions の出力変数を設定
 *
 * 安全ガード:
 *   - レコード 0件 → エラー（既存データを維持）
 *   - レコード減少 >5% → エラー（既存データを維持）
 *   - それ以外の変化 → PR を作成（管理者が承認後に適用）
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.resolve(__dirname, '../src/data');
const SCRIPTS_DIR = path.resolve(__dirname, '.');
const TMP_DIR = path.resolve(__dirname, '../tmp-update');

const FUKUOKA_JSON  = path.join(DATA_DIR, 'fukuoka-school-address-map.json');
const OITA_JSON     = path.join(DATA_DIR, 'oita-beppu-school-address-map.json');
const METADATA_JSON = path.join(SCRIPTS_DIR, 'school-data-metadata.json');

const FUKUOKA_NEW_JSON = path.join(TMP_DIR, 'fukuoka-new.json');
const OITA_NEW_JSON    = path.join(TMP_DIR, 'oita-beppu-new.json');

// GitHub Actions へ出力
function setOutput(name: string, value: string) {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `${name}=${value}\n`);
  } else {
    console.log(`[OUTPUT] ${name}=${value}`);
  }
}

// エラーレポート
function reportError(title: string, detail: string) {
  const report = `# ⚠️ ${title}\n\n${detail}\n\n**実行 URL**: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  fs.writeFileSync(path.join(TMP_DIR, 'error-report.md'), report, 'utf-8');
  setOutput('has_errors', 'true');
  setOutput('has_changes', 'false');
}

// ────────────────────────────────────────────────────────────────────────────
// Wayback Machine: 指定 URL の最新スナップショットを検索
// ────────────────────────────────────────────────────────────────────────────
async function findWaybackSnapshot(
  url: string,
  afterTimestamp: string,       // 例: "20260401"
  beforeTimestamp: string,      // 例: "20271231"
): Promise<{ timestamp: string; waybackUrl: string } | null> {
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&from=${afterTimestamp}&to=${beforeTimestamp}&fl=timestamp,statuscode&filter=statuscode:200&collapse=timestamp:8`;
    const res = await axios.get(cdxUrl, { timeout: 15000 });
    const rows: string[][] = res.data;
    if (!rows || rows.length < 2) return null;  // 先頭はヘッダー行
    const [timestamp] = rows[1];
    return {
      timestamp,
      waybackUrl: `https://web.archive.org/web/${timestamp}/${url}`,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 大分市 CSV の取得・変更確認
// ────────────────────────────────────────────────────────────────────────────
async function checkOitaData(
  metadata: any,
): Promise<{ changed: boolean; newCount?: number; error?: string }> {
  const csvUrl = metadata.oita.csv_url;
  try {
    // HEAD リクエストで Last-Modified・ETag を確認
    const head = await axios.head(csvUrl, { timeout: 10000 });
    const lastModified = head.headers['last-modified'] || '';
    const etag = head.headers['etag'] || '';
    const prevLastModified = metadata.oita.last_modified_header || '';
    const prevEtag         = metadata.oita.etag || '';

    if (lastModified !== prevLastModified || etag !== prevEtag) {
      console.log(`[Oita] 変更を検出: Last-Modified=${lastModified}`);
      // 新しい CSV をダウンロードして Python で解析
      // (オプション: Python スクリプトを呼び出す)
      return { changed: true };
    }
    return { changed: false };
  } catch (e: any) {
    return { error: `大分市 CSV 取得失敗: ${e.message}` };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 別府市 Excel の取得・変更確認
// ────────────────────────────────────────────────────────────────────────────
async function checkBeppuData(
  metadata: any,
): Promise<{ changed: boolean; newUrl?: string; error?: string }> {
  const excelUrl = metadata.beppu.excel_url;
  try {
    const head = await axios.head(excelUrl, { timeout: 10000 });
    const lastModified = head.headers['last-modified'] || '';
    const prevLastModified = metadata.beppu.last_modified_header || '';
    if (lastModified !== prevLastModified) {
      console.log(`[Beppu] 変更を検出: Last-Modified=${lastModified}`);
      return { changed: true };
    }
    return { changed: false };
  } catch (e: any) {
    // URL が変わった可能性（別府市は毎年 URL が変わることがある）
    return { error: `別府市 Excel 取得失敗 (URL 変更の可能性): ${e.message}` };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 福岡市の Wayback Machine スナップショット確認
// ────────────────────────────────────────────────────────────────────────────
async function checkWaybackPages(
  metadata: any,
  year: number,
): Promise<{ updated: string[]; waybackUrls: Record<string, string> }> {
  const afterTs  = `${year}0101`;
  const beforeTs = `${year}1231`;
  const updated: string[] = [];
  const waybackUrls: Record<string, string> = {};

  const rowsToCheck = ['ac', 'kc', 'sc', 'tc', 'nc', 'yc'];
  for (const row of rowsToCheck) {
    const metaKey = `other_rows_${row}`;
    const originalUrl = metadata.fukuoka[metaKey]?.original_url;
    if (!originalUrl) continue;

    const currentTs = metadata.fukuoka[metaKey]?.wayback_timestamp || '20250401';
    if (currentTs >= afterTs) {
      console.log(`[Wayback] ${row}: 現在のスナップショット ${currentTs} は既に ${year}年以降`);
      continue;
    }

    await new Promise(r => setTimeout(r, 1500)); // レート制限回避
    const found = await findWaybackSnapshot(originalUrl, afterTs, beforeTs);
    if (found) {
      console.log(`[Wayback] ${row}: 新スナップショット ${found.timestamp} を発見`);
      updated.push(row);
      waybackUrls[row] = found.waybackUrl;
    } else {
      console.log(`[Wayback] ${row}: ${year}年のスナップショットなし`);
    }
  }
  return { updated, waybackUrls };
}

// ────────────────────────────────────────────────────────────────────────────
// ⑤ ソース別件数チェック: 部分取得失敗時に既存データを保護する
// 「一部が取得できなかった場合に既存データ全体を書き換えない」ための安全策
// ────────────────────────────────────────────────────────────────────────────

/** 各ソースの最低期待件数（現行 569件時点） */
const MIN_RECORDS_BY_SOURCE: Record<string, number> = {
  'hc (live 2026-08)':  60,   // 実績 94件
  'mc (live 2026-08)':  50,   // 実績 76件
  'ac (WB 2026-01)':    30,   // 実績 53件
  'kc (WB 2025-04)':    50,   // 実績 85件
  'sc (WB 2025-04)':    50,   // 実績 78件
  'tc (WB 2025-04)':    50,   // 実績 80件
  'nc (WB 2025-04)':    25,   // 実績 43件
  'yc (WB 2025-04)':    30,   // 実績 53件
  'R8 PDF (2026-04)':    5,   // 実績  7件（手動補完）
};

function mergeWithExistingBySource(
  newRecords: any[],
  oldRecords: any[],
  warnFn: (msg: string) => void,
): { records: any[]; failedSources: string[] } {
  const countBySource = (recs: any[]): Record<string, number> => {
    const cnt: Record<string, number> = {};
    for (const r of recs) {
      const s = r.source || 'unknown';
      cnt[s] = (cnt[s] || 0) + 1;
    }
    return cnt;
  };

  const newCnt = countBySource(newRecords);
  const oldCnt = countBySource(oldRecords);
  const failedSources: string[] = [];
  let merged = [...newRecords];

  for (const [src, minExpected] of Object.entries(MIN_RECORDS_BY_SOURCE)) {
    const newCount = newCnt[src] || 0;
    const oldCount = oldCnt[src] || 0;

    // 新規取得数が「最低期待件数」を下回った場合 → 既存データを使用
    if (newCount < minExpected && oldCount >= minExpected) {
      failedSources.push(src);
      const oldSourceRecs = oldRecords.filter(r => (r.source || 'unknown') === src);
      // 新しいレコードセットからこのソースを除去して旧データで補完
      merged = [
        ...merged.filter(r => (r.source || 'unknown') !== src),
        ...oldSourceRecs,
      ];
      warnFn(
        `⚠️ [部分取得失敗] ${src}: 新規${newCount}件 < 最低${minExpected}件 → 既存${oldCount}件を維持`
      );
    }
  }

  return { records: merged, failedSources };
}
function computeDiff(
  oldRecords: any[],
  newRecords: any[],
  label: string,
): {
  added: any[];
  deleted: any[];
  rangeChanged: Array<{ old: any; new: any }>;
  suspicious: boolean;
} {
  function makeKey(r: any) {
    const w = r.ward || r.city || '';
    return `${w}|${r.town}|${r.juniorHigh}|${r.elementary}`;
  }
  function makeFullKey(r: any) {
    return `${makeKey(r)}|${r.range || ''}`;
  }

  const oldMap = new Map(oldRecords.map(r => [makeKey(r), r]));
  const newMap = new Map(newRecords.map(r => [makeKey(r), r]));

  const added: any[] = [];
  const deleted: any[] = [];
  const rangeChanged: Array<{ old: any; new: any }> = [];

  for (const [k, nr] of newMap) {
    if (!oldMap.has(k)) added.push(nr);
  }
  for (const [k, or] of oldMap) {
    if (!newMap.has(k)) {
      deleted.push(or);
    } else {
      const nr = newMap.get(k);
      if (or.range !== nr.range) {
        rangeChanged.push({ old: or, new: nr });
      }
    }
  }

  const oldCount = oldRecords.length;
  const newCount = newRecords.length;
  const suspicious = newCount < oldCount * 0.95;

  console.log(`[Diff ${label}] +${added.length} -${deleted.length} ~${rangeChanged.length} (${oldCount}→${newCount})`);
  return { added, deleted, rangeChanged, suspicious };
}

// ────────────────────────────────────────────────────────────────────────────
// Markdown レポート生成
// ────────────────────────────────────────────────────────────────────────────
function generateReport(
  year: number,
  fukuokaDiff: ReturnType<typeof computeDiff>,
  oitaBeppuDiff: ReturnType<typeof computeDiff>,
  fukuokaOldCount: number,
  fukuokaNewCount: number,
  oitaOldCount: number,
  oitaNewCount: number,
  warnings: string[],
  metadata: any,
  failedSources: string[] = [],
): string {
  const hasAnyChange =
    fukuokaDiff.added.length + fukuokaDiff.deleted.length + fukuokaDiff.rangeChanged.length +
    oitaBeppuDiff.added.length + oitaBeppuDiff.deleted.length + oitaBeppuDiff.rangeChanged.length > 0;
  const hasPartialFailure = failedSources.length > 0;

  const lines: string[] = [
    `# 📚 学校区データ年次更新レポート ${year}年4月`,
    '',
  ];

  // ③ 全体ステータスを明確に表示（「変更なし」と「未確認」を区別）
  if (hasPartialFailure && !hasAnyChange) {
    lines.push('> ⚠️ **一部ソース取得未確認** — 「変更なし」ではありません');
    lines.push('> 既存データで補完しましたが、下記ソースは最新公式データとの照合が未完了です。');
  } else if (hasPartialFailure && hasAnyChange) {
    lines.push('> ⚠️ **変更あり + 一部ソース取得未確認** — 内容を慎重に確認してください');
  } else if (!hasAnyChange) {
    lines.push('> ✅ **変更なし** — 全ソースの確認が完了しました');
  } else {
    lines.push('> 📝 **変更あり** — 差分内容を確認し、問題なければマージしてください');
  }
  lines.push('');

  lines.push(
    '## サマリー', '',
    '| データ | 旧件数 | 新件数 | 追加 | 削除 | 区域変更 |',
    '|---|---|---|---|---|---|',
    `| 福岡市 | ${fukuokaOldCount} | ${fukuokaNewCount} | +${fukuokaDiff.added.length} | -${fukuokaDiff.deleted.length} | ~${fukuokaDiff.rangeChanged.length} |`,
    `| 大分市・別府市 | ${oitaOldCount} | ${oitaNewCount} | +${oitaBeppuDiff.added.length} | -${oitaBeppuDiff.deleted.length} | ~${oitaBeppuDiff.rangeChanged.length} |`,
  );
  if (warnings.length > 0) {
    lines.push('', '## ⚠️ 警告', '');
    warnings.forEach(w => lines.push(`- ${w}`));
  }

  // ③ 取得未確認ソースの明示（部分取得失敗）
  if (failedSources.length > 0) {
    lines.push('', '## ❌ 取得未確認ソース（既存データで補完）', '');
    lines.push('> **これらのソースは今回の公式データとの照合が完了していません。**');
    lines.push('> 「変更なし」ではなく「**更新未確認**」として扱ってください。');
    lines.push('');
    lines.push('| ソース | 理由 | 対応 |');
    lines.push('|---|---|---|');
    failedSources.forEach(s => {
      lines.push(`| ${s} | 取得失敗（件数が最低基準を下回った） | 既存データで補完済み。手動確認を推奨。 |`);
    });
  }

  // 福岡市: 新設校
  if (fukuokaDiff.added.length > 0) {
    lines.push('', '## ⭐ 福岡市: 追加された学区（新設校・区域追加）', '');
    lines.push('| 区 | 町名 | 小学校 | 中学校 | 区域 |');
    lines.push('|---|---|---|---|---|');
    fukuokaDiff.added.slice(0, 20).forEach(r => {
      lines.push(`| ${r.ward} | ${r.town} | ${r.elementary} | ${r.juniorHigh} | ${(r.range || '').slice(0, 40)} |`);
    });
    if (fukuokaDiff.added.length > 20) lines.push(`| ...他 ${fukuokaDiff.added.length - 20}件 | | | | |`);
  }

  // 福岡市: 削除
  if (fukuokaDiff.deleted.length > 0) {
    lines.push('', '## 🗑️ 福岡市: 削除された学区', '');
    lines.push('| 区 | 町名 | 小学校 | 中学校 | 旧区域 |');
    lines.push('|---|---|---|---|---|');
    fukuokaDiff.deleted.slice(0, 20).forEach(r => {
      lines.push(`| ${r.ward} | ${r.town} | ${r.elementary} | ${r.juniorHigh} | ${(r.range || '').slice(0, 40)} |`);
    });
  }

  // 福岡市: 区域変更
  if (fukuokaDiff.rangeChanged.length > 0) {
    lines.push('', '## ✏️ 福岡市: 区域変更', '');
    lines.push('| 区 | 町名 | 中学校 | 旧区域 | 新区域 |');
    lines.push('|---|---|---|---|---|');
    fukuokaDiff.rangeChanged.slice(0, 20).forEach(({ old: o, new: n }) => {
      lines.push(`| ${o.ward} | ${o.town} | ${o.juniorHigh} | ${(o.range || '').slice(0, 30)} | ${(n.range || '').slice(0, 30)} |`);
    });
  }

  // 大分・別府
  if (oitaBeppuDiff.added.length + oitaBeppuDiff.deleted.length + oitaBeppuDiff.rangeChanged.length > 0) {
    lines.push('', '## 📍 大分市・別府市: 変更', '');
    lines.push('変更の詳細は `oita-beppu-school-address-map.json` の diff をご確認ください。');
  }

  // データソース
  lines.push('', '## 📂 データソース（⑦ 取得元・日付）', '');
  lines.push('| ソース | 種別 | データ日付 | 備考 |');
  lines.push('|---|---|---|---|');
  lines.push(`| 福岡市 hc/mc.html | ライブサイト | ${metadata.fukuoka.hc_mc.data_as_of} | 確認済み |`);
  ['ac', 'kc', 'sc', 'tc', 'nc', 'yc'].forEach(row => {
    const m = metadata.fukuoka[`other_rows_${row}`];
    if (m) {
      const verified = m.verified ? '確認済み' : '**WB未検証**';
      lines.push(`| 福岡市 ${row}.html | Wayback Machine | ${m.data_as_of} | ${verified} |`);
    }
  });
  lines.push(`| 大分市 CSV | オープンデータ | ${metadata.oita.data_as_of} | ${metadata.oita.verified ? '確認済み' : '未検証'} |`);
  lines.push(`| 別府市 Excel | 公式 | ${metadata.beppu.data_as_of} | ${metadata.beppu.verified ? '確認済み' : '未検証'} |`);

  lines.push('', '---', '');
  lines.push('> **マージ前に必ずご確認ください**');
  lines.push('> - 変更内容が公式資料と一致しているか');
  lines.push('> - 削除件数が意図的なものか（パーサーエラーでないか）');
  lines.push('> - Wayback Machine 由来のデータが実際の 2026年4月以降の変更を反映しているか');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// メイン処理
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  const year = new Date().getFullYear();
  const isDryRun = process.env.DRY_RUN === 'true';

  // tmp-update ディレクトリ作成
  fs.mkdirSync(TMP_DIR, { recursive: true });

  // メタデータ読み込み
  const metadata = JSON.parse(fs.readFileSync(METADATA_JSON, 'utf-8'));

  // ② 第1月曜日チェック: 4月の第1月曜日（1〜7日）のみ本処理を実行
  // cron は '0 2 * 4 1' (4月の全月曜) だが、
  // スクリプトで day > 7 をチェックして第1月曜日以外をスキップする。
  // JST = UTC+9 で日付を判定
  const nowUtc   = new Date();
  const nowJst   = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
  const dayOfMonthJst = nowJst.getUTCDate();
  const dayOfWeekJst  = nowJst.getUTCDay(); // 0=日,1=月,...

  if (!isDryRun && !process.env.FORCE_REBUILD) {
    if (dayOfMonthJst > 7) {
      console.log(`今日は4月${dayOfMonthJst}日です。第1月曜日ではありません（第1月曜日は1〜7日）。スキップします。`);
      setOutput('has_changes', 'false');
      setOutput('has_errors', 'false');
      return;
    }
  }

  // ② 冪等性チェック: 今年すでに実行済みなら（force_rebuild でない限り）スキップ
  // NOTE: _last_annual_check はメタデータをメインブランチに直接コミットすることで保存する。
  //       PRがマージされなくても次の月曜日にスキップできる。
  const lastCheck = metadata._last_annual_check || '';
  if (!isDryRun && !process.env.FORCE_REBUILD && lastCheck.startsWith(String(year))) {
    console.log(`今年(${year})は既に確認済みです（${lastCheck}）。スキップします。`);
    setOutput('has_changes', 'false');
    setOutput('has_errors', 'false');
    fs.writeFileSync(
      path.join(TMP_DIR, 'update-report.md'),
      `# ✅ 学校区データ年次確認 ${year}年4月: スキップ\n\n今年はすでに ${lastCheck} に確認済みです。\n`,
      'utf-8',
    );
    return;
  }

  // 現行 JSON 読み込み
  const currentFukuoka  = JSON.parse(fs.readFileSync(FUKUOKA_JSON,  'utf-8'));
  const currentOitaBeppu = JSON.parse(fs.readFileSync(OITA_JSON, 'utf-8'));
  const oldFukuokaRecords    = currentFukuoka.records  || [];
  const oldOitaBeppuRecords  = currentOitaBeppu.records || [];

  const warnings: string[] = [];
  const errors:   string[] = [];

  // ─── Step 1: Wayback Machine で新スナップショットを確認 ───────────────────
  console.log(`\n=== Step 1: Wayback Machine チェック (${year}年) ===`);
  let waybackUpdated: string[] = [];
  let waybackUrls: Record<string, string> = {};
  try {
    const wb = await checkWaybackPages(metadata, year);
    waybackUpdated = wb.updated;
    waybackUrls = wb.waybackUrls;
    if (waybackUpdated.length > 0) {
      warnings.push(`Wayback Machine で ${waybackUpdated.join(', ')}.html の新スナップショットを発見。自動的に取得します。`);
    }
  } catch (e: any) {
    warnings.push(`Wayback Machine 確認エラー: ${e.message}。既存データを維持します。`);
  }

  // ─── Step 2: 大分市 CSV の変更確認 ───────────────────────────────────────
  console.log('\n=== Step 2: 大分市 CSV 変更確認 ===');
  const oitaCheck = await checkOitaData(metadata);
  if (oitaCheck.error) {
    warnings.push(oitaCheck.error);
  }

  // ─── Step 3: 別府市 Excel の変更確認 + 大分市確認（Python スクリプト実行）─────
  console.log('\n=== Step 3: 大分市・別府市 確認（Python）===');
  let oitaBeppuChanged = false;
  let oitaBeppuErrors: string[] = [];
  try {
    execSync(`python ${path.join(SCRIPTS_DIR, 'check-oita-beppu-updates.py')}`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      timeout: 60 * 1000,
      env: { ...process.env, GITHUB_OUTPUT: process.env.GITHUB_OUTPUT || '' },
    });
    const checkResult = path.join(TMP_DIR, 'oita-beppu-check.json');
    if (fs.existsSync(checkResult)) {
      const r = JSON.parse(fs.readFileSync(checkResult, 'utf-8'));
      oitaBeppuChanged = r.has_changes || false;
      oitaBeppuErrors = r.errors || [];
      if (oitaBeppuErrors.length > 0) {
        oitaBeppuErrors.forEach(e => warnings.push(e));
      }
    }
  } catch (e: any) {
    warnings.push(`大分市・別府市チェックエラー: ${e.message}。既存データを維持します。`);
  }

  // ─── Step 4: 福岡市 HTML を再スクレイプ ──────────────────────────────────
  console.log('\n=== Step 4: 福岡市 HTML 再スクレイプ ===');
  let newFukuokaRecords = oldFukuokaRecords;
  try {
    // 既存のビルドスクリプトを実行（新 JSON を tmp に生成）
    const buildScript = path.join(SCRIPTS_DIR, 'build-fukuoka-school-address-map.ts');
    // 出力先を一時ファイルに変更するため環境変数で渡す
    execSync(
      `npx ts-node ${buildScript}`,
      {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, SCHOOL_OUTPUT_PATH: FUKUOKA_NEW_JSON },
        stdio: 'inherit',
        timeout: 5 * 60 * 1000,
      }
    );
    if (fs.existsSync(FUKUOKA_NEW_JSON)) {
      const newData = JSON.parse(fs.readFileSync(FUKUOKA_NEW_JSON, 'utf-8'));
      newFukuokaRecords = newData.records || [];
      console.log(`[Fukuoka] 新規: ${newFukuokaRecords.length}件`);
    } else {
      // 出力パス環境変数が使われなかった場合、デフォルト出力先からコピー
      const defaultOutput = path.join(DATA_DIR, 'fukuoka-school-address-map.json');
      const newData = JSON.parse(fs.readFileSync(defaultOutput, 'utf-8'));
      newFukuokaRecords = newData.records || [];
      // 一時コピー
      fs.copyFileSync(defaultOutput, FUKUOKA_NEW_JSON);
    }
  } catch (e: any) {
    errors.push(`福岡市 HTML 取得失敗: ${e.message}`);
    newFukuokaRecords = oldFukuokaRecords; // フォールバック
  }

  // ─── Step 5: 安全ガード ────────────────────────────────────────────────────
  if (newFukuokaRecords.length === 0) {
    const msg = `❌ 福岡市データの解析結果が 0 件です。ネットワークエラーまたはパース失敗の可能性があります。既存データを維持します。`;
    reportError('学校区データ取得失敗 - 福岡市', msg);
    process.exit(1);
  }

  // ⑤ ソース別マージ: 取得できなかったソースは既存データで補完
  const { records: mergedFukuokaRecords, failedSources } = mergeWithExistingBySource(
    newFukuokaRecords,
    oldFukuokaRecords,
    (msg) => warnings.push(msg),
  );

  if (mergedFukuokaRecords.length < oldFukuokaRecords.length * 0.95) {
    const msg = `❌ マージ後もレコードが異常に減少しました (${oldFukuokaRecords.length}→${mergedFukuokaRecords.length})。パーサーエラーの可能性があります。`;
    reportError('学校区データ取得失敗 - 異常な件数減少', msg);
    process.exit(1);
  }

  if (failedSources.length > 0) {
    warnings.push(`一部ソース取得失敗 (${failedSources.join(', ')}) → 既存データを補完しました。`);
  }

  // ─── Step 6: 差分計算 ─────────────────────────────────────────────────────
  console.log('\n=== Step 6: 差分計算 ===');
  const fukuokaDiff = computeDiff(oldFukuokaRecords, mergedFukuokaRecords, '福岡市');
  const oitaBeppuDiff = computeDiff(oldOitaBeppuRecords, oldOitaBeppuRecords, '大分/別府');
  // ※ 大分/別府の自動更新は確認のみ。実際の更新は別途 Python スクリプトで行う。

  const hasAnyChange =
    fukuokaDiff.added.length + fukuokaDiff.deleted.length + fukuokaDiff.rangeChanged.length > 0
    || oitaBeppuChanged
    || waybackUpdated.length > 0
    || process.env.FORCE_REBUILD === 'true';

  // ③ 部分取得失敗の検出: 既存データで補完した場合は「更新未確認」として扱う
  const hasPartialFailure = failedSources.length > 0;
  // 部分取得失敗 = データ変更の可能性が確認できていない → PR で通知が必要
  const needsPrOrNotification = hasAnyChange || hasPartialFailure;

  // ─── Step 7: メタデータ更新 ────────────────────────────────────────────────
  metadata._last_annual_check = new Date().toISOString().split('T')[0];
  metadata._next_annual_check = `${year + 1}-04-01`;
  metadata._total_records = newFukuokaRecords.length + oldOitaBeppuRecords.length;
  // Wayback Machine の新スナップショットがあれば更新
  for (const row of waybackUpdated) {
    const metaKey = `other_rows_${row}`;
    if (metadata.fukuoka[metaKey] && waybackUrls[row]) {
      const ts = waybackUrls[row].match(/web\/(\d{14})\//)?.[1] || '';
      if (ts) {
        const dateStr = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
        metadata.fukuoka[metaKey].wayback_timestamp = ts.slice(0, 8);
        metadata.fukuoka[metaKey].data_as_of = dateStr;
        metadata.fukuoka[metaKey].notes += ` （${dateStr} 版のスナップショットに更新）`;
      }
    }
  }

  // ─── Step 8: レポート生成 ──────────────────────────────────────────────────
  const report = generateReport(
    year,
    fukuokaDiff,
    oitaBeppuDiff,
    oldFukuokaRecords.length,
    mergedFukuokaRecords.length,
    oldOitaBeppuRecords.length,
    oldOitaBeppuRecords.length,
    warnings,
    metadata,
    failedSources,
  );

  fs.writeFileSync(path.join(TMP_DIR, 'update-report.md'), report, 'utf-8');
  // PR body 用にコピー
  fs.writeFileSync(path.join(DATA_DIR, '../tmp-update-report.md'), report, 'utf-8');
  fs.writeFileSync(
    path.join(SCRIPTS_DIR, 'school-data-metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8',
  );

  // ─── Step 9: 出力変数 ──────────────────────────────────────────────────────
  // ③ 部分取得失敗時は has_changes=true にして PR/通知フローに乗せる
  const effectiveHasChanges = needsPrOrNotification;
  setOutput('has_changes', String(effectiveHasChanges));
  setOutput('has_errors', 'false');
  setOutput('has_partial_failure', String(hasPartialFailure));
  setOutput('failed_sources', failedSources.join(', '));
  setOutput('change_summary',
    `福岡市: +${fukuokaDiff.added.length}/-${fukuokaDiff.deleted.length}/~${fukuokaDiff.rangeChanged.length}` +
    (hasPartialFailure ? ` (未確認:${failedSources.length}件)` : '') +
    `, 大分/別府: ${oitaBeppuChanged ? '変更あり' : '変更なし'}`
  );

  console.log(`\n=== 完了 ===`);
  console.log(`変更あり: ${effectiveHasChanges}`);
  console.log(`部分取得失敗: ${hasPartialFailure} (${failedSources.join(', ') || 'なし'})`);
  console.log(`警告: ${warnings.length}件`);
  console.log(`エラー: ${errors.length}件`);

  if (isDryRun) {
    console.log('\n[DRY RUN] PR/Issue 作成はスキップします。');
    console.log('レポート:');
    console.log(report);
  }
}

main().catch(e => {
  console.error('致命的エラー:', e);
  const detail = `スクリプト実行中に予期しないエラーが発生しました。\n\n\`\`\`\n${e.stack || e.message}\n\`\`\``;
  const tmpDir = path.resolve(__dirname, '../tmp-update');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'error-report.md'), detail, 'utf-8');
  setOutput('has_errors', 'true');
  setOutput('has_changes', 'false');
  process.exit(1);
});
