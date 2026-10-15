/**
 * 学校区自動判定システム 整合性チェック（読み取りのみ・DBは更新しない）
 *
 * seller_attached_document2 に保存済みの学校名と、
 * 現在の判定ロジック（住所対応表→GeoJSON）で再判定した結果を比較する。
 *
 * 使い方:
 *   npx ts-node backend/check-school-district-integrity.ts           # 全件チェック
 *   npx ts-node backend/check-school-district-integrity.ts FI637     # 1件だけ確認
 *   npx ts-node backend/check-school-district-integrity.ts --fi      # FI売主のみ
 *   npx ts-node backend/check-school-district-integrity.ts --aa      # AA売主のみ
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { lookupFukuokaSchool } from './src/services/FukuokaSchoolAddressService';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// ---- JSONデータ読み込み ----
const fukuokaMap        = require('./src/data/fukuoka-school-address-map.json');
const oitaBeppuMap      = require('./src/data/oita-beppu-school-address-map.json');
const fukuokaElemGeo    = require('./src/data/fukuoka-elementary-school-districts.json');
const fukuokaMiddleGeo  = require('./src/data/fukuoka-middle-school-districts.json');
const nationalElemGeo   = require('./src/data/school-districts.json');
const nationalMiddleGeo = require('./src/data/middle-school-districts.json');

// ===========================================================================
// ユーティリティ
// ===========================================================================

function toHalf(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

/**
 * Ray Casting法による Point-in-Polygon
 * polygon は GeoJSON形式: [[lng, lat], ...]
 */
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]; // GeoJSON: [lng, lat]
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * nearbyMap.ts のインライン isInRange を完全再現
 * (production で実際に動いているロジック)
 *
 * ⚠️ 既知の挙動: "全域（ただし〜を除く）" は除外チェックをスキップして true を返す
 */
function isInRangeProd(range: string, chomeNum: number | null, banNum: number | null): boolean {
  if (!range || range.includes('全域')) return true;
  if (range.includes('ただし') || range.includes('除く') || range.includes('照会')) return true;

  const parts = range.split(/[、，,]/).map((p: string) => p.trim()).filter(Boolean);
  let lastChome: number | null = null;

  for (const part of parts) {
    // 「1丁目～3丁目」
    const chomeRangeM = part.match(/^(\d+)丁目～(\d+)丁目$/);
    if (chomeRangeM) {
      if (chomeNum !== null) {
        const from = parseInt(chomeRangeM[1], 10);
        const to   = parseInt(chomeRangeM[2], 10);
        if (chomeNum >= from && chomeNum <= to) return true;
      }
      continue;
    }
    // 「N丁目（番地範囲）」
    const chomeWithBanM = part.match(/^(\d+)丁目(.*)$/);
    if (chomeWithBanM) {
      const partChome = parseInt(chomeWithBanM[1], 10);
      lastChome = partChome;
      if (chomeNum !== null && chomeNum !== partChome) continue;
      const rest = chomeWithBanM[2].trim();
      if (!rest) return true; // 丁目のみ → 全番地OK
      const banRangeM = rest.match(/^(\d+)番～(\d+)番/);
      if (banRangeM) {
        if (banNum === null) return true;
        const from = parseInt(banRangeM[1], 10);
        const to   = parseInt(banRangeM[2], 10);
        if (banNum >= from && banNum <= to) return true;
      }
      continue;
    }
    // 単独「N番」（直前の丁目コンテキストを使う）
    const banOnlyM = part.match(/^(\d+)番$/);
    if (banOnlyM && lastChome !== null) {
      if (chomeNum !== null && chomeNum === lastChome) {
        if (banNum !== null && banNum === parseInt(banOnlyM[1], 10)) return true;
      }
      continue;
    }
    // 単独「N丁目」
    const chomeOnlyM = part.match(/^(\d+)丁目$/);
    if (chomeOnlyM) {
      lastChome = parseInt(chomeOnlyM[1], 10);
      if (chomeNum !== null && chomeNum === lastChome) return true;
      continue;
    }
  }
  return false;
}

// ===========================================================================
// 判定ロジック
// ===========================================================================

interface LookupResult {
  elementary: string | null;
  juniorHigh: string | null;
  source: 'fukuoka_address_table' | 'oita_address_table' | 'fukuoka_geojson' | 'national_geojson' | 'no_hit';
  confidence: 'confirmed' | 'uncertain' | 'geojson';
  /** 住所対応表でヒットした range 文字列（"全域（ただし...）"か否かの判定用） */
  matchedRange?: string;
}

/** 福岡市住所対応表による照合（nearbyMap.ts の production ロジックと同一） */
function lookupFukuokaAddressTable(address: string): LookupResult | null {
  const records: any[] = fukuokaMap.records || [];
  if (!records.length) return null;

  const wardM = address.match(/([東南西北博多中央城南早良]+区)/);
  const ward = wardM ? wardM[1] : null;
  if (!ward) return null;

  const afterWard = address.split(ward)[1] || '';
  const townM = afterWard.match(/^([^\d\-ー－\s\u3000]+)/);
  const rawTown = townM ? townM[1].trim().replace(/[の\s　]+$/, '') : null;
  if (!rawTown) return null;

  const townCandidates = [rawTown, ...(rawTown.endsWith('町') ? [] : [rawTown + '町'])];

  const chomeM = address.match(/(\d+)丁目/);
  const chomeNum = chomeM ? parseInt(chomeM[1], 10) : null;
  const afterWard2 = address.split(ward)[1] || '';
  const hyphenM = afterWard2.match(/\d+丁目(\d+)[-ー－]/);
  const banM = address.match(/(\d+)番/);
  const banNum = hyphenM ? parseInt(hyphenM[1], 10) : (banM ? parseInt(banM[1], 10) : null);

  for (const tc of townCandidates) {
    const hits = records.filter((r: any) => r.ward === ward && r.town === tc);
    if (!hits.length) continue;

    // production と同じ: 全域優先 → レンジチェック
    const best = hits.find((r: any) => !r.range || r.range.includes('全域'))
      ?? hits.find((r: any) => isInRangeProd(r.range, chomeNum, banNum));

    if (!best) {
      // ヒットしたが全レコードがレンジ外
      return null;
    }

    // 例外住所フラグ（「ただし」「除く」含むレンジ）
    const hasException = best.range &&
      (best.range.includes('ただし') || best.range.includes('除く') || best.range.includes('照会'));

    return {
      elementary:   best.elementary,
      juniorHigh:   best.juniorHigh,
      source:       'fukuoka_address_table',
      confidence:   hasException ? 'uncertain' : 'confirmed',
      matchedRange: best.range || '(全域)',
    };
  }
  return null;
}

/** 大分市・別府市住所対応表による照合（nearbyMap.ts の production ロジックと同一） */
function lookupOitaBeppuAddressTable(address: string): LookupResult | null {
  const records: any[] = oitaBeppuMap.records || [];
  if (!records.length) return null;

  let city: string | null = null;
  if (address.includes('大分市'))      city = '大分市';
  else if (address.includes('別府市')) city = '別府市';
  if (!city) return null;

  const afterCity = address.split(city)[1] || '';
  if (!afterCity) return null;

  const afterCityNorm = toHalf(afterCity);
  const townWithChomeMatch = afterCityNorm.match(/^([^\d\-\s　]*(?:\d+丁目)?)/);
  const townWithChome = townWithChomeMatch
    ? townWithChomeMatch[1].replace(/[の\s　]+$/, '').trim()
    : '';

  const cityRecords = records.filter((r: any) => r.city === city);
  const candidates = [
    ...cityRecords.filter((r: any) => r.town === townWithChome),
    ...cityRecords.filter((r: any) =>
      townWithChome &&
      r.town !== townWithChome &&
      r.town.startsWith(townWithChome.replace(/\d+丁目$/, '').trim())
    ),
  ];
  if (!candidates.length) return null;

  // ⚠️ candidates[0] を無条件採用（nearbyMap.ts と同一ロジック）
  const best = candidates[0];
  const hasException = best.town.includes('の一部') || best.town.includes('を除く') || best.town.includes('以外');

  return {
    elementary:   best.elementary,
    juniorHigh:   best.juniorHigh,
    source:       'oita_address_table',
    confidence:   hasException ? 'uncertain' : 'confirmed',
    matchedRange: best.town,
  };
}

/** GeoJSON Point-in-Polygon による照合 */
function lookupGeoJSON(lat: number, lng: number): LookupResult | null {
  const inFukuoka = lng >= 130.0 && lng <= 130.5 && lat >= 33.4 && lat <= 33.9;

  let elementary: string | null = null;
  let juniorHigh: string | null = null;
  let elemSource: 'fukuoka_geojson' | 'national_geojson' = 'national_geojson';

  // 小学校（福岡市内は公式データ優先）
  const elemTargets = inFukuoka
    ? [{ data: fukuokaElemGeo,   src: 'fukuoka_geojson' as const },
       { data: nationalElemGeo,  src: 'national_geojson' as const }]
    : [{ data: nationalElemGeo,  src: 'national_geojson' as const },
       { data: fukuokaElemGeo,   src: 'fukuoka_geojson' as const }];

  outer: for (const t of elemTargets) {
    for (const feature of (t.data.features || [])) {
      let matched = false;
      const geomType = feature.geometry?.type;
      if (geomType === 'Polygon') {
        if (pointInPolygon(lat, lng, feature.geometry.coordinates[0])) matched = true;
      } else if (geomType === 'MultiPolygon') {
        for (const rings of feature.geometry.coordinates) {
          if (pointInPolygon(lat, lng, rings[0])) { matched = true; break; }
        }
      }
      if (matched) {
        elementary = feature.properties?.name || null;
        elemSource = t.src;
        break outer;
      }
    }
  }

  // 中学校（福岡市内は公式データ優先）
  const middleTargets = inFukuoka
    ? [{ data: fukuokaMiddleGeo,  src: 'fukuoka_geojson' as const },
       { data: nationalMiddleGeo, src: 'national_geojson' as const }]
    : [{ data: nationalMiddleGeo, src: 'national_geojson' as const },
       { data: fukuokaMiddleGeo,  src: 'fukuoka_geojson' as const }];

  outerJh: for (const t of middleTargets) {
    for (const feature of (t.data.features || [])) {
      let matched = false;
      const geomType = feature.geometry?.type;
      if (geomType === 'Polygon') {
        if (pointInPolygon(lat, lng, feature.geometry.coordinates[0])) matched = true;
      } else if (geomType === 'MultiPolygon') {
        for (const rings of feature.geometry.coordinates) {
          if (pointInPolygon(lat, lng, rings[0])) { matched = true; break; }
        }
      }
      if (matched) {
        juniorHigh = feature.properties?.name || null;
        break outerJh;
      }
    }
  }

  if (!elementary && !juniorHigh) return null;
  return { elementary, juniorHigh, source: elemSource, confidence: 'geojson' };
}

/** メイン判定: 住所対応表 → GeoJSON の順でフォールバック */
function determineSchool(
  address: string,
  lat: number | null,
  lng: number | null,
): LookupResult {
  // 1. 福岡市住所対応表（新統合サービス - 番地/号レベル対応）
  if (address.includes('福岡市')) {
    try {
      const res = lookupFukuokaSchool(address);
      if (res) {
        const elem = res.elementary === '-' ? res.juniorHigh : res.elementary;
        return {
          elementary:   elem,
          juniorHigh:   res.juniorHigh,
          source:       'fukuoka_address_table',
          confidence:   res.confidence,
          matchedRange: undefined,
        };
      }
    } catch {}
    // ヒットなし → GeoJSONへ
  }

  // 2. 大分市・別府市住所対応表
  if (address.includes('大分市') || address.includes('別府市')) {
    const res = lookupOitaBeppuAddressTable(address);
    if (res) return res;
  }

  // 3. GeoJSON フォールバック
  if (lat !== null && lng !== null) {
    const res = lookupGeoJSON(lat, lng);
    if (res) return res;
  }

  return { elementary: null, juniorHigh: null, source: 'no_hit', confidence: 'confirmed' };
}

// ===========================================================================
// 名寄せ（「福岡市立 春吉小学校」と「春吉小学校」を同一視）
// ===========================================================================
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim()
    .replace(/^.*立/, '')  // 「XX立」を除去
    .replace(/\s+/g, '');
}

function namesMatch(stored: string | null, determined: string | null): boolean {
  if (!stored && !determined) return true;
  if (!stored || !determined) return false;
  const a = normalizeName(stored);
  const b = normalizeName(determined);
  return a === b || a.includes(b) || b.includes(a);
}

// ===========================================================================
// メイン
// ===========================================================================
async function main() {
  const args = process.argv.slice(2);
  const specificSeller = args.find((a) => !a.startsWith('--')) || null;
  const fiOnly  = args.includes('--fi');
  const aaOnly  = args.includes('--aa');

  console.log('=================================================================');
  console.log('  学校区自動判定システム 整合性チェック');
  console.log('  ⚠️  読み取りのみ・DBは更新しない');
  console.log('=================================================================\n');

  if (specificSeller) console.log(`対象: ${specificSeller} のみ\n`);
  else if (fiOnly)    console.log('対象: FI売主のみ\n');
  else if (aaOnly)    console.log('対象: AA売主のみ\n');
  else                console.log('対象: 全売主\n');

  // --- 1. seller_attached_document2 から学校データを取得 ---
  const { data: docs, error: docsErr } = await supabase
    .from('seller_attached_document2')
    .select(`
      seller_id,
      elementary_school_name,
      junior_high_school_name,
      elementary_school_confirmed,
      junior_high_school_confirmed,
      school_info_fetched_at
    `)
    .or('elementary_school_name.not.is.null,junior_high_school_name.not.is.null');

  if (docsErr) { console.error('❌ seller_attached_document2 取得失敗:', docsErr); process.exit(1); }
  if (!docs?.length) { console.log('学校データなし（終了）'); return; }

  // --- 2. 対応する sellers を取得（property_address, lat, lng） ---
  const sellerIds = docs.map((d: any) => d.seller_id);

  // Supabase の IN クエリは 1000件上限があるため分割取得
  const CHUNK = 900;
  let sellers: any[] = [];
  for (let i = 0; i < sellerIds.length; i += CHUNK) {
    const chunk = sellerIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, property_address, latitude, longitude')
      .in('id', chunk)
      .is('deleted_at', null);
    if (error) { console.error('❌ sellers 取得失敗:', error); process.exit(1); }
    sellers = sellers.concat(data || []);
  }

  const sellerMap: Record<string, any> = {};
  for (const s of sellers) sellerMap[s.id] = s;

  // --- 3. 各レコードを再判定 ---
  type Row = {
    seller_number: string;
    address: string;
    stored_elem: string | null;
    stored_jh: string | null;
    determined_elem: string | null;
    determined_jh: string | null;
    source: string;
    confidence: string;
    matched_range: string | undefined;
    has_coords: boolean;
    is_auto: boolean;
    elem_confirmed: boolean;
    jh_confirmed: boolean;
    elem_status: 'MATCH' | 'MISMATCH' | 'UNVERIFIABLE';
    jh_status:   'MATCH' | 'MISMATCH' | 'UNVERIFIABLE';
  };

  const mismatches:    Row[] = [];
  const uncertains:   Row[] = [];
  const unverifiables: Row[] = [];
  const matches:       Row[] = [];

  let total = 0;
  let skipped = 0;

  for (const doc of docs) {
    const seller = sellerMap[doc.seller_id];
    if (!seller) { skipped++; continue; }

    const sn: string = seller.seller_number || '';

    // フィルタリング
    if (specificSeller && sn !== specificSeller) continue;
    if (fiOnly && !sn.startsWith('FI')) continue;
    if (aaOnly && !sn.startsWith('AA')) continue;

    total++;

    const address: string = seller.property_address || '';
    const lat: number | null = seller.latitude != null ? Number(seller.latitude) : null;
    const lng: number | null = seller.longitude != null ? Number(seller.longitude) : null;

    if (!address) {
      // 住所なし → 判定不能
      unverifiables.push({
        seller_number: sn, address: '(住所なし)',
        stored_elem: doc.elementary_school_name, stored_jh: doc.junior_high_school_name,
        determined_elem: null, determined_jh: null,
        source: 'no_hit', confidence: 'no_address',
        matched_range: undefined, has_coords: !!(lat && lng),
        is_auto: !!doc.school_info_fetched_at,
        elem_confirmed: !!doc.elementary_school_confirmed,
        jh_confirmed: !!doc.junior_high_school_confirmed,
        elem_status: 'UNVERIFIABLE', jh_status: 'UNVERIFIABLE',
      });
      continue;
    }

    const determined = determineSchool(address, lat, lng);

    const elemMatch = namesMatch(doc.elementary_school_name, determined.elementary);
    const jhMatch   = namesMatch(doc.junior_high_school_name, determined.juniorHigh);

    const noHit = determined.source === 'no_hit';

    const row: Row = {
      seller_number:  sn,
      address,
      stored_elem:    doc.elementary_school_name,
      stored_jh:      doc.junior_high_school_name,
      determined_elem: determined.elementary,
      determined_jh:  determined.juniorHigh,
      source:         determined.source,
      confidence:     determined.confidence,
      matched_range:  determined.matchedRange,
      has_coords:     !!(lat && lng),
      is_auto:        !!doc.school_info_fetched_at,
      elem_confirmed: !!doc.elementary_school_confirmed,
      jh_confirmed:   !!doc.junior_high_school_confirmed,
      elem_status: noHit ? 'UNVERIFIABLE' : (elemMatch ? 'MATCH' : 'MISMATCH'),
      jh_status:   noHit ? 'UNVERIFIABLE' : (jhMatch   ? 'MATCH' : 'MISMATCH'),
    };

    const hasMismatch    = row.elem_status === 'MISMATCH' || row.jh_status === 'MISMATCH';
    const hasUncertain   = determined.confidence === 'uncertain' && !hasMismatch;
    const hasUnverifiable = noHit || (!lat || !lng);

    if (hasMismatch)       mismatches.push(row);
    else if (hasUncertain) uncertains.push(row);
    else if (hasUnverifiable && !hasMismatch) unverifiables.push(row);
    else                   matches.push(row);
  }

  // ===========================================================================
  // レポート出力
  // ===========================================================================

  console.log('=================================================================');
  console.log('  集計結果');
  console.log('=================================================================');
  console.log(`チェック対象: ${total}件（スキップ ${skipped}件）`);
  console.log(`  ✅ 一致          : ${matches.length}件`);
  console.log(`  ❌ 不一致        : ${mismatches.length}件  ← 要確認`);
  console.log(`  ⚠️  例外住所      : ${uncertains.length}件  ← "ただし〜を除く" の可能性あり`);
  console.log(`  ❓ 判定不能      : ${unverifiables.length}件  ← GeoJSON・住所対応表共にミス`);
  console.log('');

  // ---- 不一致詳細 ----
  if (mismatches.length > 0) {
    console.log('=================================================================');
    console.log(`  ❌ 不一致一覧 (${mismatches.length}件)`);
    console.log('=================================================================');
    for (const m of mismatches) {
      console.log(`\n【${m.seller_number}】 ${m.address}`);
      if (m.elem_status === 'MISMATCH') {
        console.log(`  小学校: DB="${m.stored_elem}"  ←→  再判定="${m.determined_elem}"`);
      } else if (m.elem_status === 'MATCH') {
        console.log(`  小学校: ✅ 一致 (${m.stored_elem})`);
      }
      if (m.jh_status === 'MISMATCH') {
        console.log(`  中学校: DB="${m.stored_jh}"  ←→  再判定="${m.determined_jh}"`);
      } else if (m.jh_status === 'MATCH') {
        console.log(`  中学校: ✅ 一致 (${m.stored_jh})`);
      }
      console.log(`  判定元: ${m.source} (${m.confidence})`);
      if (m.matched_range) console.log(`  マッチしたレンジ: "${m.matched_range}"`);
      const flags: string[] = [];
      if (m.is_auto) flags.push('自動取得済み');
      if (m.elem_confirmed) flags.push('小学校手動確認済み');
      if (m.jh_confirmed)   flags.push('中学校手動確認済み');
      if (!m.has_coords) flags.push('座標なし（GeoJSONスキップ）');
      if (flags.length) console.log(`  🏷️  ${flags.join(' / ')}`);
    }
  }

  // ---- 例外住所詳細 ----
  if (uncertains.length > 0) {
    console.log('\n=================================================================');
    console.log(`  ⚠️  例外住所・要確認 (${uncertains.length}件)`);
    console.log('  ("全域（ただし〜を除く）" 等の除外チェックがスキップされた住所)');
    console.log('=================================================================');
    for (const u of uncertains) {
      console.log(`  ${u.seller_number}: ${u.address}`);
      console.log(`    DB: 小=${u.stored_elem ?? '未設定'} / 中=${u.stored_jh ?? '未設定'}`);
      console.log(`    再判定: 小=${u.determined_elem ?? '判定不能'} / 中=${u.determined_jh ?? '判定不能'}`);
      if (u.matched_range) console.log(`    レンジ: "${u.matched_range}"`);
    }
  }

  // ---- 判定不能詳細 ----
  if (unverifiables.length > 0) {
    console.log('\n=================================================================');
    console.log(`  ❓ 判定不能一覧 (${unverifiables.length}件)`);
    console.log('  (住所対応表に未収録、かつGeoJSONにもヒットしなかった）');
    console.log('=================================================================');
    for (const u of unverifiables) {
      const coordFlag = u.has_coords ? '座標あり' : '座標なし';
      console.log(`  ${u.seller_number}: ${u.address || '(住所なし)'}  [${coordFlag}]`);
      console.log(`    DB: 小=${u.stored_elem ?? '未設定'} / 中=${u.stored_jh ?? '未設定'}`);
    }
  }

  // ---- ソース別内訳 ----
  console.log('\n=================================================================');
  console.log('  判定元内訳（全件）');
  console.log('=================================================================');
  const allRows = [...matches, ...mismatches, ...uncertains, ...unverifiables];
  const srcCount: Record<string, number> = {};
  for (const r of allRows) {
    srcCount[r.source] = (srcCount[r.source] || 0) + 1;
  }
  for (const [src, cnt] of Object.entries(srcCount).sort((a, b) => b[1] - a[1])) {
    const label = {
      fukuoka_address_table: '福岡市住所対応表（最精確）',
      oita_address_table:    '大分/別府住所対応表',
      fukuoka_geojson:       '福岡市公式GeoJSON',
      national_geojson:      '国土数値情報GeoJSON',
      no_hit:                '判定不能',
    }[src] || src;
    console.log(`  ${label}: ${cnt}件`);
  }

  // ---- システム既知の問題サマリー ----
  console.log('\n=================================================================');
  console.log('  既知のシステム制約（再掲）');
  console.log('=================================================================');
  console.log('  1. 福岡市住所対応表のカバー範囲は「は行・ま行」中学校のみ');
  console.log('     か行(警固中,片江中...) さ行(城南中...) た行(田島中...) など → GeoJSONフォールバック');
  console.log('  2. "全域（ただし〜を除く）" の除外番地チェックがスキップされる');
  console.log('     → 例外住所欄の件数を要確認');
  console.log('  3. 大分/別府住所対応表は candidates[0] を無条件採用');
  console.log('     → 同一町名で複数校区がある場合に誤判定リスクあり');
  console.log('  4. GeoJSONのPoint-in-Polygonは境界付近で誤判定する可能性がある');

  console.log('\n✅ チェック完了（DBは変更していません）');
  console.log('不一致が0件以外の場合、修正前に必ずユーザーに報告してください。\n');
}

main().catch(console.error);
