/**
 * 福岡市 通学区域 住所対応表 ビルドスクリプト
 *
 * 福岡市教育委員会の公式Webページ（は行・ま行: 現行、その他: Wayback Machine）から
 * 全中学校行の通学区域データをスクレイプし、
 * backend/src/data/fukuoka-school-address-map.json を再生成する。
 *
 * 使い方: npx ts-node backend/scripts/build-fukuoka-school-address-map.ts
 *
 * 出力: backend/src/data/fukuoka-school-address-map.json
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_PATH = path.resolve(__dirname, '../src/data/fukuoka-school-address-map.json');

// ページ定義
const PAGES = [
  { key: 'ac', label: 'あ行', url: 'https://web.archive.org/web/20260101000000/https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-ac.html' },
  { key: 'kc', label: 'か行', url: 'https://web.archive.org/web/20250401/https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-kc.html' },
  { key: 'sc', label: 'さ行', url: 'https://web.archive.org/web/20250401/https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-sc.html' },
  { key: 'tc', label: 'た行', url: 'https://web.archive.org/web/20250401/https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-tc.html' },
  { key: 'nc', label: 'な行', url: 'https://web.archive.org/web/20250401/https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-nc.html' },
  { key: 'yc', label: 'や行', url: 'https://web.archive.org/web/20250401/https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-yc.html' },
  { key: 'hc', label: 'は行', url: 'https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-hc.html' },
  { key: 'mc', label: 'ま行', url: 'https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku-mc.html' },
];

interface DistrictRecord {
  ward: string;
  town: string;
  range: string;
  elementary: string;
  juniorHigh: string;
  note: string;
}

// =====================================================================
// HTML テーブル形式のパーサー
//
// 福岡市の通学区域ページは以下の6列テーブルを使用:
//   中学校 | 小学校 | 区名 | 町名 | 区域 | 備考
//
// ポイント: 中学校/小学校/備考セルは rowspan を使用するため、
//   継続行には [区名][町名][区域] の3セルしか存在しない。
//   また、小学校が変わる行には [小学校名][区名][町名][区域] の4セルが存在する。
// =====================================================================
function parseHtmlTable(html: string): DistrictRecord[] {
  const records: DistrictRecord[] = [];

  const VALID_WARDS = ['東区', '西区', '南区', '北区', '博多区', '中央区', '城南区', '早良区'];
  const isWard = (s: string) => VALID_WARDS.some(w => (s || '').includes(w));
  const isJh   = (s: string) => !!(s || '').match(/^[^\s]+中$/);
  const isElem = (s: string) => !!(s || '').match(/^[^\s]+小$/);

  // セルテキストを取得
  const extractCell = (td: string) =>
    td.replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\s*[　\s]+\s*$/, ''); // 全角スペースのみ → 空文字

  // <tr> ブロックを抽出
  const trBlocks = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  let currentJh   = '';
  let currentElem = '';
  let currentWard = '';

  for (const tr of trBlocks) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(extractCell);
    if (cells.length === 0) continue;

    // ヘッダー行をスキップ
    if (cells[0] === '中学校' || cells[0] === '小学校' || cells[0] === '区名') continue;

    let jh = '', elem = '', ward = '', town = '', range = '', note = '';

    if (cells.length >= 6) {
      // フルセット行: [JH][elem][ward][town][range][note]
      // rowspan なし (各スクレイプでの1行目 or rowspan未使用ページ)
      if (isJh(cells[0]) || isElem(cells[0])) {
        jh    = cells[0]; elem  = cells[1]; ward  = cells[2];
        town  = cells[3]; range = cells[4]; note  = cells[5];
      } else if (isWard(cells[2])) {
        jh    = cells[0]; elem  = cells[1]; ward  = cells[2];
        town  = cells[3]; range = cells[4]; note  = cells[5];
      } else {
        // 不明な6列 → スキップ
        continue;
      }
    } else if (cells.length === 5) {
      // 小学校変更 + 区名 + 町名 + 区域 + 備考: [elem][ward][town][range][note]
      if (isElem(cells[0]) && isWard(cells[1])) {
        jh = currentJh; elem = cells[0]; ward = cells[1];
        town = cells[2]; range = cells[3]; note = cells[4];
      } else if (isJh(cells[0]) && isWard(cells[2])) {
        jh = cells[0]; elem = cells[1]; ward = cells[2];
        town = cells[3]; range = cells[4];
      } else {
        continue;
      }
    } else if (cells.length === 4) {
      // 小学校変更行: [elem][ward][town][range]
      if (isElem(cells[0]) && isWard(cells[1])) {
        jh = currentJh; elem = cells[0]; ward = cells[1];
        town = cells[2]; range = cells[3];
      } else if (isWard(cells[0])) {
        // 区名変更: [ward][town][range][note]
        jh = currentJh; elem = currentElem; ward = cells[0];
        town = cells[1]; range = cells[2]; note = cells[3];
      } else {
        continue;
      }
    } else if (cells.length === 3) {
      // 最頻出の継続行: [ward][town][range] または [town][range][note]
      if (isWard(cells[0])) {
        // 区が変わる継続行
        jh = currentJh; elem = currentElem; ward = cells[0];
        town = cells[1]; range = cells[2];
      } else if (isElem(cells[0])) {
        // 小学校のみ変更行
        jh = currentJh; elem = cells[0]; ward = currentWard;
        town = cells[1]; range = cells[2];
      } else {
        // 純粋継続行 (区・JH・小学校すべて継続)
        jh = currentJh; elem = currentElem; ward = currentWard;
        town = cells[0]; range = cells[1]; note = cells[2];
      }
    } else if (cells.length === 2) {
      // 町名+区域のみ（全継続）
      if (!cells[0] || !cells[1]) continue;
      jh = currentJh; elem = currentElem; ward = currentWard;
      town = cells[0]; range = cells[1];
    } else {
      continue;
    }

    // 状態更新
    if (jh)   currentJh   = jh;
    if (elem) currentElem = elem;
    if (ward && isWard(ward)) currentWard = ward;

    // バリデーション
    if (!currentJh || !currentWard || !town || !range) continue;
    if (town === '町名' || range === '区域') continue; // ヘッダー行誤検知

    records.push({
      ward:       currentWard,
      town:       town.replace(/\r?\n/g, '').trim(),
      range:      range.replace(/\r?\n/g, '').trim(),
      elementary: currentElem,
      juniorHigh: currentJh,
      note:       (note || '').replace(/\r?\n/g, '').trim(),
    });
  }

  return records;
}

// =====================================================================
// テキスト形式のパーサー（Wayback Machine の一部で table タグが欠落）
// "早良中早良小早良区大字内野全域" のような連結テキストを解析
// =====================================================================
function parseTextFormat(html: string): DistrictRecord[] {
  const records: DistrictRecord[] = [];

  // まず HTML タグを除去してテキストを取得
  const text = html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');

  // 行ごとに処理
  const lines = text.split('\n');

  const WARDS = ['博多区', '東区', '西区', '南区', '北区', '中央区', '城南区', '早良区'];
  const WARD_RE = new RegExp(`(${WARDS.join('|')})`);

  let currentJh = '';
  let currentElem = '';
  let currentWard = '';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // "中学校" "小学校" "区名" "町名" "区域" "備考" ヘッダー行をスキップ
    if (line === '中学校' || line === '小学校' || line === '区名' || line === '町名' || line === '区域' || line === '備考') continue;
    if (/^中学校　[あ-ん]行/.test(line)) continue;

    // 区名を含む行の解析
    const wardMatch = WARD_RE.exec(line);
    if (wardMatch) {
      const wardIdx = wardMatch.index;
      const beforeWard = line.slice(0, wardIdx);
      const afterWard = line.slice(wardIdx + wardMatch[0].length);

      // beforeWard から JH / 小学校 名を抽出
      const jhMatch = beforeWard.match(/([^\s]+中)/);
      const elemMatch = beforeWard.match(/([^\s]+小)/);

      if (jhMatch) currentJh = jhMatch[1];
      if (elemMatch) currentElem = elemMatch[1];
      currentWard = wardMatch[0];

      // afterWard = "町名区域備考" → 区域(数字・全域・丁目を含む部分)で分割
      const townRangeMatch = afterWard.match(/^([^\d全丁番号一-九〇-九]+?)(全域.*|[\d一-九].*|[〇-九].*)$/u);
      if (townRangeMatch) {
        const town = townRangeMatch[1].trim();
        const range = townRangeMatch[2].trim().replace(/\s*（.*?に.*?あり）?$/, '');
        if (town && range) {
          records.push({ ward: currentWard, town, range, elementary: currentElem, juniorHigh: currentJh, note: '' });
        }
      }
    } else {
      // 区名なし行 → 継続行（町名と区域のみ）
      const townRangeMatch = line.match(/^([^\d全丁番号一-九〇-九]+?)(全域.*|[\d一-九].*|[〇-九].*)$/u);
      if (townRangeMatch && currentJh && currentWard) {
        const town = townRangeMatch[1].trim();
        // "小学校名" が混入していたら取り除く
        const elem = town.match(/([^\s]+小)/);
        if (elem) {
          currentElem = elem[1];
          continue; // 小学校名変更行
        }
        const range = townRangeMatch[2].trim().replace(/\s*（.*?に.*?あり）?$/, '');
        if (town && range) {
          records.push({ ward: currentWard, town, range, elementary: currentElem, juniorHigh: currentJh, note: '' });
        }
      }
    }
  }

  return records;
}

// =====================================================================
// 統合パーサー（HTML テーブルが存在する場合はそちらを優先）
// =====================================================================
function parseHtml(html: string, key: string): DistrictRecord[] {
  // HTML テーブルが存在するかチェック
  if (html.includes('<tr') && html.includes('<td')) {
    const r = parseHtmlTable(html);
    if (r.length > 0) return r;
  }
  // テキスト形式にフォールバック
  console.log(`  [${key}] テーブル形式なし → テキスト形式パーサー使用`);
  return parseTextFormat(html);
}

// =====================================================================
// メイン
// =====================================================================
async function main() {
  console.log('=======================================================');
  console.log('  福岡市 通学区域 住所対応表 ビルドスクリプト');
  console.log('=======================================================\n');

  const allRecords: DistrictRecord[] = [];
  let totalPages = 0;

  for (const page of PAGES) {
    console.log(`[${page.key}] ${page.label} を取得中...`);
    try {
      const response = await axios.get(page.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; school-district-builder/1.0)' },
        timeout: 30000,
        responseType: 'arraybuffer',
      });
      // Shift-JIS → UTF-8 対応（Wayback Machine は UTF-8 で返すことが多い）
      const html = Buffer.from(response.data).toString('utf-8');

      const records = parseHtml(html, page.key);
      allRecords.push(...records);
      totalPages++;
      console.log(`  → ${records.length}件 取得`);
    } catch (e: any) {
      console.error(`  ❌ ${page.label} 取得失敗: ${e.message}`);
    }

    // レート制限回避
    await new Promise(r => setTimeout(r, 1000));
  }

  // 重複除去（ward + town + range + juniorHigh で一意）
  const seen = new Set<string>();
  const deduped = allRecords.filter(r => {
    const key = `${r.ward}|${r.town}|${r.range}|${r.juniorHigh}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── 2026年 R8 PDF 補完データ ──────────────────────────────────────────────
  // Wayback Machine データには含まれていない 2026年新設・更新分を手動で追加
  // 出典: 福岡市 R8（令和8年4月1日現在）学校別通学区域一覧 R8gakkoubetu.pdf
  const R8_SUPPLEMENTS: DistrictRecord[] = [
    // 周船寺中（2026年4月開校 - Wayback Machineデータに未収録）
    // 元岡中から分離された西区西部エリア
    {
      ward: '西区', town: '周船寺',
      range: '1丁目(ただし、13番(25号、28号)を除く···元岡小)、2丁目1番～18番、3丁目',
      elementary: '周船寺小', juniorHigh: '周船寺中', note: '',
    },
    {
      ward: '西区', town: '徳永北',
      range: '全域',
      elementary: '周船寺小', juniorHigh: '周船寺中', note: '',
    },
    {
      ward: '西区', town: '大字徳永',
      range: '660',
      elementary: '周船寺小', juniorHigh: '周船寺中', note: '660番地のみ',
    },
    {
      ward: '西区', town: '女原北',
      range: '全域',
      elementary: '西都小', juniorHigh: '周船寺中', note: '',
    },
    {
      ward: '西区', town: '大字女原',
      range: '全域',
      elementary: '西都小', juniorHigh: '周船寺中', note: '',
    },
    {
      ward: '西区', town: '大字德永',
      range: '全域(ただし、660を除く···周船寺小)',
      elementary: '西都小', juniorHigh: '周船寺中', note: '',
    },
    {
      ward: '西区', town: '西都',
      range: '2丁目',
      elementary: '西都小', juniorHigh: '周船寺中', note: '',
    },
  ];

  // 補完データを追加（既存キーと重複しない場合のみ）
  for (const supp of R8_SUPPLEMENTS) {
    const key = `${supp.ward}|${supp.town}|${supp.range}|${supp.juniorHigh}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(supp);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // 空のレコードを除外
  const valid = deduped.filter(r => r.ward && r.town && r.range && r.juniorHigh);

  const output = {
    version: '2026-04-01',
    source: [
      'は行・ま行: 福岡市教育委員会 https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/ (2026年8月)',
      'あ・か・さ・た・な・や行: Wayback Machine 2025-04-01版 / 2026-01-01版',
      '周船寺中: 福岡市 R8（2026年4月1日現在）学校別通学区域一覧PDF 手動補完',
    ],
    note: '周船寺中は2026年4月開校の新設中学校。GeoJSON(fukuoka-middle-school-districts.json)には2025-12-26版で収録済み。',
    recordCount: valid.length,
    pages: totalPages,
    records: valid,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ 完了: ${valid.length}件 → ${OUTPUT_PATH}`);
  console.log(`   取得ページ数: ${totalPages}/${PAGES.length}`);
}

main().catch(console.error);
