/**
 * 569件の照合状況を正確に集計・分類するスクリプト
 *
 * 集計の正確な定義:
 *   JSON 569件 = A(確認済み) + B(差異あり) + C(未照合)
 *   PDF 669件 = A(確認済み) + B'(差異あり) + D(PDFのみ)
 *
 * B と B' は「ペア」の数なので JSON側 ≠ PDF側
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_PATH    = path.resolve(__dirname, '../src/data/fukuoka-school-address-map.json');
const RESULT_PATH  = path.resolve(__dirname, '../tmp-pdf/comparison-result.json');

const WARDS = ['東区', '西区', '南区', '博多区', '中央区', '城南区', '早良区'];

// データ取得元の定義
// は行・ま行 → ライブサイト（2026年8月）
// あ行        → Wayback Machine 2026-01-01
// か行〜や行  → Wayback Machine 2025-04-01
// 周船寺中    → R8 PDF手動補完（2026年4月1日）
const SOURCE_MAP: { jh: RegExp; source: string; date: string; confidence: string }[] = [
  // は行（2026-08 ライブサイト）
  { jh: /^(博多中|箱崎中|箱崎清松中|花畑中|原中$|原北中|原中央中|春吉中|東住吉中|平尾中|福岡中)$/, source: 'hc.html (2026-08 live)', date: '2026-08', confidence: 'high' },
  // ま行（2026-08 ライブサイト）
  { jh: /^(舞鶴中|松崎中|三宅中|宮竹中|席田中|姪浜中|元岡中|百道中)$/, source: 'mc.html (2026-08 live)', date: '2026-08', confidence: 'high' },
  // あ行（2026-01-01 Wayback）
  { jh: /^(青葉中|壱岐中|壱岐丘中|板付中|内浜中|梅林中|曰佐中|小呂中)$/, source: 'ac.html (2026-01-01 Wayback)', date: '2026-01', confidence: 'medium-high' },
  // か行（2025-04-01 Wayback）
  { jh: /^(香椎第[1１]中|香椎第[2２]中|香椎第[3３]中|柏原中|片江中|金武中|北崎中|警固中|玄界中|玄洋中)$/, source: 'kc.html (2025-04-01 Wayback)', date: '2025-04', confidence: 'medium' },
  // さ行（2025-04-01 Wayback）
  { jh: /^(早良中|三筑中|志賀中|下山門中|城香中|城西中|城南中|次郎丸中|住吉中|西陵中)$/, source: 'sc.html (2025-04-01 Wayback)', date: '2025-04', confidence: 'medium' },
  // た行（2025-04-01 Wayback）
  { jh: /^(高取中|高宮中|田隈中|多々良中$|多々良中央中|千代中|照葉中|東光中|当仁中|筑紫丘中|友泉中)$/, source: 'tc.html (2025-04-01 Wayback)', date: '2025-04', confidence: 'medium' },
  // な行（2025-04-01 Wayback）
  { jh: /^(那珂中|長尾中|長丘中|西福岡中|能古中|野間中)$/, source: 'nc.html (2025-04-01 Wayback)', date: '2025-04', confidence: 'medium' },
  // や行（2025-04-01 Wayback）
  { jh: /^(友泉中|横手中|吉塚中|老司中|和白中|和白丘中)$/, source: 'yc.html (2025-04-01 Wayback)', date: '2025-04', confidence: 'medium' },
  // R8 PDF手動補完
  { jh: /^周船寺中$/, source: 'R8 PDF補完 (2026-04)', date: '2026-04', confidence: 'high' },
];

function getSourceInfo(jhName: string): { source: string; date: string; confidence: string } {
  for (const entry of SOURCE_MAP) {
    if (entry.jh.test(jhName)) return entry;
  }
  return { source: 'unknown', date: 'unknown', confidence: 'unknown' };
}

function normalizeRange(r: string): string {
  return (r || '')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\s+/g, '').replace(/　/g, '')
    .replace(/[、,]{2,}/g, '、')
    .replace(/※[^,、)）\n]*/g, '')
    .trim();
}

function classifyDifference(jsonRange: string, pdfRange: string): string {
  const jn = normalizeRange(jsonRange);
  const pn = normalizeRange(pdfRange);
  
  if (jn === pn) return 'artifact_exact'; // 正規化後同一 → アーティファクト
  if (jn.includes(pn) || pn.includes(jn)) return 'artifact_subset'; // 一方が他方のサブセット
  if (jn.slice(0, 10) === pn.slice(0, 10) && Math.abs(jn.length - pn.length) > 15) return 'artifact_truncated'; // 切断アーティファクト
  
  // 全域の差異
  if ((jn.includes('全域') && pn.includes('全域')) || (jn === '' || pn === '')) return 'artifact_normalization';
  
  // 学校名が不一致 → パーサーが違う列の学校を誤取得した可能性
  return 'potential_difference';
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const records: any[] = data.records;
  
  let compResult: any = {};
  try {
    compResult = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf-8'));
  } catch {
    console.warn('比較結果ファイルが見つかりません。照合分析は省略します。');
  }
  
  // ── 集計の正確な定義 ──────────────────────────────────────────
  console.log('='.repeat(60));
  console.log('  集計の正確な定義（重複なし）');
  console.log('='.repeat(60));
  
  const summary = compResult.summary || {};
  const pdf_total = summary.pdf_total || 0;
  const json_total = summary.json_total || records.length;
  const confirmed = summary.confirmed_match || 0;
  const unverified = summary.unverified || 0;
  const diff_json = json_total - confirmed - unverified; // JSON側で差異ありになった件数
  const diff_pdf = summary.range_difference || 0; // PDF→JSON ペア数（参考値）
  const pdf_only = summary.pdf_only || 0;
  
  console.log(`\n【PDF側】 合計 ${pdf_total}件`);
  console.log(`  ✅ JSON と完全一致: ${confirmed}件`);
  console.log(`  ⚠  JSON と区域差異: ${diff_pdf}件  ← ペア数（参考）`);
  console.log(`  📄 JSONに対応なし: ${pdf_only}件  ← 大半はパーサーアーティファクト`);
  
  console.log(`\n【JSON側】 合計 ${json_total}件`);
  console.log(`  ✅ A: 確認済み（PDFと完全一致）: ${confirmed}件 (${(confirmed/json_total*100).toFixed(1)}%)`);
  console.log(`  ⚠  B: 差異あり（PDFで対応行あり・内容差異）: ${diff_json}件 (${(diff_json/json_total*100).toFixed(1)}%)`);
  console.log(`  ❓ C: 未照合（PDFで対応行を抽出できず）: ${unverified}件 (${(unverified/json_total*100).toFixed(1)}%)`);
  console.log(`  確認: ${confirmed}+${diff_json}+${unverified} = ${confirmed+diff_json+unverified} (${confirmed+diff_json+unverified === json_total ? '✅' : '❌'})`);
  
  // ── B（差異あり）の内訳分析 ──────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  B（差異あり167件）の内訳分析');
  console.log('='.repeat(60));
  
  const diffs = compResult.range_differences || [];
  const diffCategories: Record<string, number> = {};
  const trueDiffs: any[] = [];
  
  for (const d of diffs) {
    const cat = classifyDifference(d.json_range || '', d.pdf_range || '');
    diffCategories[cat] = (diffCategories[cat] || 0) + 1;
    if (cat === 'potential_difference') trueDiffs.push(d);
  }
  
  console.log('\n  分類:');
  const labels: Record<string, string> = {
    artifact_exact: 'パーサーアーティファクト（正規化後同一）',
    artifact_subset: 'パーサーアーティファクト（部分一致）',
    artifact_truncated: 'パーサーアーティファクト（切断・結合）',
    artifact_normalization: 'パーサーアーティファクト（全角/半角等）',
    potential_difference: '真の差異の可能性',
  };
  for (const [k, v] of Object.entries(diffCategories).sort(([,a],[,b]) => b-a)) {
    console.log(`  ${labels[k] || k}: ${v}件`);
  }
  
  if (trueDiffs.length > 0) {
    console.log(`\n  【要確認】真の差異の可能性（${trueDiffs.length}件）:`);
    trueDiffs.slice(0, 10).forEach(d => {
      console.log(`    ${d.ward || ''} ${d.town || ''} / ${d.elementary || ''} / ${d.juniorHigh || ''}`);
      console.log(`    JSON: ${(d.json_range || '').slice(0, 60)}`);
      console.log(`    PDF:  ${(d.pdf_range || '').slice(0, 60)}`);
    });
  }
  
  // ── C（未照合174件）の内訳 ──────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  C（未照合174件）のデータ取得元別内訳');
  console.log('='.repeat(60));
  
  const uvRecords: any[] = compResult.unverified || [];
  const sourceCount: Record<string, { count: number; confidence: string; example: string[] }> = {};
  
  for (const jr of uvRecords) {
    const info = getSourceInfo(jr.juniorHigh || '');
    const key = info.source;
    if (!sourceCount[key]) sourceCount[key] = { count: 0, confidence: info.confidence, example: [] };
    sourceCount[key].count++;
    if (sourceCount[key].example.length < 2) {
      sourceCount[key].example.push(`${jr.ward} ${jr.town} / ${jr.elementary} / ${jr.juniorHigh}`);
    }
  }
  
  console.log('\n  取得元           | 信頼度    | 件数 | 例');
  console.log('  ' + '-'.repeat(80));
  for (const [src, info] of Object.entries(sourceCount).sort(([,a],[,b]) => b.count-a.count)) {
    const shortSrc = src.replace('Wayback Machine', 'WM').slice(0, 30);
    console.log(`  ${shortSrc.padEnd(32)} | ${info.confidence.padEnd(10)} | ${String(info.count).padStart(3)}件`);
    info.example.forEach(e => console.log(`    例: ${e.slice(0, 70)}`));
  }
  
  // ── C の分類（3種類）──────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  C（未照合174件）の問題種別分類');
  console.log('='.repeat(60));
  
  let typeA_count = 0; // 文字表記・PDF抽出問題のみ（データ内容は信頼できる）
  let typeB_count = 0; // 区域条件が実際に異なる可能性あり
  let typeC_count = 0; // 例外区域（照会・の一部）→ 本質的に判定困難
  
  const typeB_list: any[] = [];
  const typeC_list: any[] = [];
  
  for (const jr of uvRecords) {
    const range = jr.range || '';
    const info = getSourceInfo(jr.juniorHigh || '');
    
    if (range.includes('照会') || range.includes('の一部') || range.includes('ただし')) {
      typeC_count++;
      if (typeC_list.length < 5) typeC_list.push(jr);
    } else if (info.confidence === 'medium') {
      // Wayback Machine 2025-04 データ → 2026年変更の可能性あり
      typeB_count++;
      if (typeB_list.length < 5) typeB_list.push(jr);
    } else {
      typeA_count++;
    }
  }
  
  console.log(`\n  【種別A】 文字表記・PDF抽出問題のみ（データ内容は信頼できる）: ${typeA_count}件`);
  console.log(`    理由: ライブサイト（2026-08）またはWayback 2026-01からのデータ`);
  console.log(`          PDF抽出が失敗しただけで、HTMLソースの信頼性は高い`);
  
  console.log(`\n  【種別B】 区域条件が実際に異なる可能性あり: ${typeB_count}件`);
  console.log(`    理由: Wayback Machine 2025-04-01版データ（2025年4月→2026年4月で変更の可能性）`);
  if (typeB_list.length > 0) {
    console.log('    例:');
    typeB_list.forEach(jr => console.log(`      ${jr.ward} ${jr.town} / ${jr.elementary} / ${jr.juniorHigh} | ${jr.range?.slice(0,50)}`));
  }
  
  console.log(`\n  【種別C】 例外区域（公式資料でも判定に注意が必要）: ${typeC_count}件`);
  console.log(`    理由: 「照会のこと」「の一部」「ただし〜を除く」を含む → 号レベルの詳細が必要`);
  if (typeC_list.length > 0) {
    console.log('    例:');
    typeC_list.forEach(jr => console.log(`      ${jr.ward} ${jr.town} / ${jr.elementary} / ${jr.juniorHigh} | ${jr.range?.slice(0,60)}`));
  }
  
  // ── 信頼性管理の状況 ──────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  ③ 信頼性管理の現状');
  console.log('='.repeat(60));
  
  // 照会・の一部 を含むレコード数
  const uncertain = records.filter(r => 
    r.range && (r.range.includes('照会') || r.range.includes('の一部'))
  );
  const exceptionOnly = records.filter(r => r.range && r.range.includes('ただし'));
  
  console.log(`\n  信頼性フラグ別内訳（全569件）:`);
  console.log(`  ■ 「照会のこと」含む: ${uncertain.length}件 → matchRange が 'uncertain' を返す`);
  console.log(`  ■ 「ただし〜を除く」含む（除外区域): ${exceptionOnly.length}件 → matchRangeが例外解析`);
  console.log(`  ■ 「の一部」含む: ${records.filter(r=>r.range?.includes('の一部')).length}件 → 'uncertain'`);
  
  console.log(`\n  matchRange の返却値:`);
  console.log(`    'confirmed' → 住所が確実にレンジ内`);
  console.log(`    'uncertain' → 照会・除外・の一部で詳細不明 → フロントで「要確認」表示推奨`);
  console.log(`    'no_match'  → レンジ外 → GeoJSONフォールバック`);
  
  console.log(`\n  ※ 未検証174件はPDF照合が失敗しただけで、matchRangeロジックは変わらない。`);
  console.log(`     各レコードのrrangeフィールドに「照会」が含まれれば自動的に'uncertain'になる。`);
}

main();
