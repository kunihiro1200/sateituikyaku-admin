/**
 * FukuokaSchoolAddressService
 *
 * 福岡市公式通学区域テーブル（番地レベル）を使った学区照合サービス。
 *
 * データソース:
 *   https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/
 *   backend/src/data/fukuoka-school-address-map.json
 *
 * 仕組み:
 *   1. 物件住所から「区名」「町名」「丁目（あれば）」「番（あれば）」を抽出
 *   2. ルックアップテーブルで (区名, 町名) を照合
 *   3. 区域の範囲チェック（全域 / 丁目範囲 / 番地範囲）
 *   4. 一致したら (小学校, 中学校) を返す
 *
 * カバー範囲（2026/10時点）:
 *   は行中学校（博多, 箱崎, 花畑, 原, 春吉, 東住吉, 平尾, 福岡）
 *   ま行中学校（舞鶴, 松崎, 三宅, 宮竹, 席田, 姪浜, 元岡, 百道）
 *   それ以外のエリアは null を返す → GeoJSON Point-in-Polygon にフォールバック
 */

let schoolAddressMap: any = null;

function loadSchoolAddressMap() {
  if (schoolAddressMap) return schoolAddressMap;
  try {
    schoolAddressMap = require('../data/fukuoka-school-address-map.json');
    console.log(`[FukuokaSchool] 住所対応表読み込み: ${schoolAddressMap.recordCount}件`);
  } catch (err: any) {
    console.warn('[FukuokaSchool] 住所対応表の読み込み失敗:', err.message);
    schoolAddressMap = { records: [] };
  }
  return schoolAddressMap;
}

/**
 * 住所文字列から構成要素を抽出する
 *
 * 例: "福岡市南区玉川町5番3号" → { ward:"南区", town:"玉川町", chome:null, ban:5, go:3 }
 * 例: "福岡市博多区博多駅前1丁目4番5号" → { ward:"博多区", town:"博多駅前", chome:1, ban:4, go:5 }
 */
export interface ParsedAddress {
  ward: string | null;      // 区名（例: "南区"）
  town: string | null;      // 町名（例: "玉川町"）
  chome: number | null;     // 丁目番号（例: 1）
  ban: number | null;       // 番（例: 5）
  go: number | null;        // 号（例: 3）
}

export function parseAddress(address: string): ParsedAddress {
  const result: ParsedAddress = {
    ward: null, town: null, chome: null, ban: null, go: null,
  };

  if (!address) return result;

  // 区名を抽出（福岡市X区 or 単に X区）
  const wardMatch = address.match(/([東南西北博多中央城南早良]+区)/);
  if (wardMatch) result.ward = wardMatch[1];

  // 町名を抽出（X区以降の文字列から取得）
  // パターン: 区名の後の文字〜丁目・番・号の前まで
  const afterWard = result.ward ? address.split(result.ward)[1] || '' : address;
  const townMatch = afterWard.match(/^([^\d丁番号\s]+(?:町|丁目前後|通|浜|団地|公園|ふ頭)?)/);
  if (townMatch) {
    // 「〇丁目」が町名の一部の場合を除外
    let town = townMatch[1].trim();
    // 末尾の不要文字を除去
    town = town.replace(/[の\s　]+$/, '').trim();
    if (town) result.town = town;
  }

  // 丁目番号
  const chomeMatch = address.match(/(\d+)丁目/);
  if (chomeMatch) result.chome = parseInt(chomeMatch[1], 10);

  // 番
  const banMatch = address.match(/(\d+)番/);
  if (banMatch) result.ban = parseInt(banMatch[1], 10);

  // 号
  const goMatch = address.match(/(\d+)号/);
  if (goMatch) result.go = parseInt(goMatch[1], 10);

  return result;
}

/**
 * 区域文字列（range）と住所の丁目・番号を照合する
 *
 * range 例:
 *   "全域"                → 常に true
 *   "1丁目～3丁目"        → chome が 1〜3 ならtrue
 *   "1番～5番"             → ban が 1〜5 ならtrue
 *   "1丁目1番～8番"        → chome=1 かつ ban が 1〜8 ならtrue
 *   "全域(ただし、..."     → 例外処理は省略して基本は全域として扱う
 *
 * @returns 'match' | 'no_match' | 'uncertain' (複雑な条件や例外あり)
 */
function matchRange(range: string, chome: number | null, ban: number | null): 'match' | 'no_match' | 'uncertain' {
  if (!range || range.trim() === '' || range.includes('全域')) {
    return 'match'; // 全域は常にマッチ
  }

  const r = range.trim();

  // 「ただし、...を除く」が含まれる場合は不確実
  if (r.includes('ただし') || r.includes('除く') || r.includes('照会')) {
    // 基本的にマッチとして扱い、フロントで「要確認」表示
    return 'uncertain';
  }

  // 「1丁目～3丁目」パターン
  const chomeRangeMatch = r.match(/^(\d+)丁目～(\d+)丁目$/);
  if (chomeRangeMatch) {
    if (chome === null) return 'uncertain';
    const from = parseInt(chomeRangeMatch[1], 10);
    const to   = parseInt(chomeRangeMatch[2], 10);
    return (chome >= from && chome <= to) ? 'match' : 'no_match';
  }

  // 「1丁目」のみ
  const chomeOnlyMatch = r.match(/^(\d+)丁目$/);
  if (chomeOnlyMatch) {
    if (chome === null) return 'uncertain';
    return chome === parseInt(chomeOnlyMatch[1], 10) ? 'match' : 'no_match';
  }

  // 「1丁目、2丁目、3丁目」パターン（カンマ区切り）
  if (r.match(/^(\d+丁目[、，]?)+$/) || r.match(/^[\d丁目、，]+$/)) {
    if (chome === null) return 'uncertain';
    const chomes = (r.match(/\d+(?=丁目)/g) || []).map(Number);
    return chomes.includes(chome) ? 'match' : 'no_match';
  }

  // 「1番～5番」パターン
  const banRangeMatch = r.match(/^(\d+)番～(\d+)番/);
  if (banRangeMatch) {
    if (ban === null) return 'uncertain';
    const from = parseInt(banRangeMatch[1], 10);
    const to   = parseInt(banRangeMatch[2], 10);
    return (ban >= from && ban <= to) ? 'match' : 'no_match';
  }

  // 丁目+番の複合パターンは不確実として扱う
  if (r.includes('丁目') && r.includes('番')) {
    // 丁目だけ確認
    if (chome !== null) {
      const chomeMatch = r.match(/^(\d+)丁目/);
      if (chomeMatch && chome !== parseInt(chomeMatch[1], 10)) {
        return 'no_match'; // 丁目が違う
      }
    }
    return 'uncertain'; // 番地まで確認が必要
  }

  return 'uncertain';
}

/**
 * 物件住所から福岡市の学区を照合する
 *
 * @param address 物件住所（例: "福岡市南区玉川町5番3号"）
 * @returns { elementary, juniorHigh, confidence } | null
 */
export interface SchoolLookupResult {
  elementary: string;
  juniorHigh: string;
  ward: string;
  town: string;
  confidence: 'confirmed' | 'uncertain'; // uncertain = 番地例外の可能性あり
}

export function lookupFukuokaSchool(address: string): SchoolLookupResult | null {
  const map = loadSchoolAddressMap();
  const records = map.records as any[];
  if (!records?.length) return null;

  const parsed = parseAddress(address);
  if (!parsed.ward || !parsed.town) return null;

  // 町名で候補を絞り込む
  const candidates = records.filter(
    (r) => r.ward === parsed.ward && r.town === parsed.town
  );

  if (!candidates.length) {
    // 丁目なし町名でも試す（例: "博多駅前1丁目" → town="博多駅前"）
    return null;
  }

  // 区域チェック
  let bestMatch: { record: any; confidence: 'confirmed' | 'uncertain' } | null = null;

  for (const rec of candidates) {
    const result = matchRange(rec.range, parsed.chome, parsed.ban);
    if (result === 'match') {
      bestMatch = { record: rec, confidence: 'confirmed' };
      break; // 完全一致が見つかれば即採用
    } else if (result === 'uncertain' && !bestMatch) {
      bestMatch = { record: rec, confidence: 'uncertain' };
      // 不確実でも候補として保持（より良いものがあれば上書き）
    }
  }

  if (!bestMatch) return null;

  return {
    elementary: bestMatch.record.elementary,
    juniorHigh: bestMatch.record.juniorHigh,
    ward: bestMatch.record.ward,
    town: bestMatch.record.town,
    confidence: bestMatch.confidence,
  };
}
