/**
 * FukuokaSchoolAddressService
 *
 * 福岡市公式通学区域テーブル（番地・号レベル）を使った学区照合サービス。
 *
 * データソース:
 *   は行・ま行: https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/
 *   あ〜や行:   Wayback Machine 2025-04-01版
 *   生成スクリプト: backend/scripts/build-fukuoka-school-address-map.ts
 *
 * カバー範囲: 福岡市全中学校区（562件、2026年10月現在）
 */

// -----------------------------------------------------------------------
// データ読み込み
// -----------------------------------------------------------------------
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

// -----------------------------------------------------------------------
// 住所パース
// -----------------------------------------------------------------------
export interface ParsedAddress {
  ward:  string | null;   // 区名（例: "中央区"）
  town:  string | null;   // 町名（例: "渡辺通"）
  chome: number | null;   // 丁目番号
  ban:   number | null;   // 番
  go:    number | null;   // 号
}

export function parseAddress(address: string): ParsedAddress {
  const result: ParsedAddress = { ward: null, town: null, chome: null, ban: null, go: null };
  if (!address) return result;

  // 全角数字・全角ハイフンを半角に正規化
  const addr = address
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[－ー]/g, '-');

  // 区名
  const wardM = addr.match(/([東南西北博多中央城南早良]+区)/);
  if (wardM) result.ward = wardM[1];

  const afterWard = result.ward ? addr.split(result.ward)[1] || '' : addr;

  // 町名（数字・ハイフン・スペースの前まで）
  const townM = afterWard.match(/^([^\d\-\s　]+)/);
  if (townM) result.town = townM[1].trim().replace(/[の\s　]+$/, '');

  // 丁目
  const chomeM = addr.match(/(\d+)丁目/);
  if (chomeM) {
    result.chome = parseInt(chomeM[1], 10);
    // 丁目の後の番・号: "5丁目24-30" or "5丁目24番30号"
    const afterChome = addr.slice(addr.indexOf(chomeM[0]) + chomeM[0].length);
    const banGoM = afterChome.match(/^(\d+)(?:-(\d+)(?:-(\d+))?)?/);
    if (banGoM) {
      result.ban = parseInt(banGoM[1], 10);
      if (banGoM[2]) result.go = parseInt(banGoM[2], 10);
      if (banGoM[3]) result.go = parseInt(banGoM[3], 10);
    }
  } else {
    // ハイフン形式 "玉川3-25" → chome=3, ban=25
    const hyphenM = afterWard.match(/^[^\d]*(\d+)-(\d+)(?:-(\d+))?/);
    if (hyphenM) {
      result.chome = parseInt(hyphenM[1], 10);
      result.ban   = parseInt(hyphenM[2], 10);
      if (hyphenM[3]) result.go = parseInt(hyphenM[3], 10);
    }
  }

  // 「番」形式（丁目なし or 補完）
  if (result.ban === null) {
    const banM = addr.match(/(\d+)番/);
    if (banM) result.ban = parseInt(banM[1], 10);
  }

  // 「号」形式（独立した「号」）
  if (result.go === null) {
    const goM = addr.match(/(\d+)号/);
    if (goM) result.go = parseInt(goM[1], 10);
  }

  return result;
}

// -----------------------------------------------------------------------
// 区域文字列（range）照合
// -----------------------------------------------------------------------
/**
 * カンマ区切りをパース（括弧内のカンマは無視）
 */
function splitRangeParts(range: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of range) {
    if (ch === '(' || ch === '（') { depth++; current += ch; }
    else if (ch === ')' || ch === '）') { depth--; current += ch; }
    else if ((ch === '、' || ch === ',') && depth === 0) {
      const t = current.trim();
      if (t) parts.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) parts.push(t);
  return parts;
}

/**
 * 号の範囲チェック: "5号～10号、15号" vs go
 * "終" は無限大 (999) として扱う
 */
function matchGoRange(goSpec: string, go: number | null): boolean | null {
  if (go === null) return null; // 判定不能

  const normalized = goSpec.replace(/終/, '999');
  const parts = normalized.split(/[、,]/);

  for (const p of parts) {
    const rangeM = p.match(/(\d+)号～(\d+)号/);
    if (rangeM) {
      if (go >= parseInt(rangeM[1], 10) && go <= parseInt(rangeM[2], 10)) return true;
    }
    const singleM = p.match(/(\d+)号/);
    if (singleM && parseInt(singleM[1], 10) === go) return true;
  }
  return false;
}

/**
 * 「ただし〜を除く」例外節から住所が除外されるかチェック
 * @returns true = 除外される, false = 除外されない, null = 判定不能
 */
function isExcludedByClause(
  exc: string,        // 例: "3丁目20番の一部を除く・・・笹丘小", "13番(21号～37号)を除く"
  chome: number | null,
  ban:   number | null,
  go:    number | null,
): boolean | null {

  // 例外節の丁目・番を抽出
  const excChomeM = exc.match(/(\d+)丁目/);
  const excBanM   = exc.match(/(\d+)番/);
  const excChome  = excChomeM ? parseInt(excChomeM[1], 10) : null;
  const excBan    = excBanM   ? parseInt(excBanM[1],   10) : null;

  // 丁目が違う → 除外されない
  if (excChome !== null && chome !== null && chome !== excChome) return false;

  // 番が違う → 除外されない
  if (excBan !== null && ban !== null && ban !== excBan) return false;

  // 号範囲チェック: "13番(21号～37号)" のような括弧内 go 仕様
  const goRangeM = exc.match(/\((\d+)号～(\d+)号\)/);
  if (goRangeM && go !== null) {
    const from = parseInt(goRangeM[1], 10);
    const to   = parseInt(goRangeM[2], 10);
    if (go < from || go > to) return false; // go が範囲外 → 除外されない
    return true; // go が範囲内 → 除外される
  }

  // "の一部" → 細部不明のため判定不能
  if (exc.includes('の一部')) return null;

  // 丁目も番も一致、go仕様なし → 除外される可能性が高い（uncertain）
  if (excChome !== null && chome === excChome) {
    if (excBan === null || ban === excBan) return null; // 詳細不明
  }

  return null;
}

/**
 * 1つのパート（"5丁目20番～24番" 等）を照合する
 * @returns { matched, uncertain, newChome }
 */
function matchPart(
  part: string,
  addrChome: number | null,
  addrBan:   number | null,
  addrGo:    number | null,
  ctxChome:  number | null,  // 直前パートから引き継いだ丁目コンテキスト
): { matched: boolean; uncertain: boolean; newChome: number | null } {

  const UNCERTAIN = { matched: false, uncertain: true,  newChome: ctxChome };
  const NO_MATCH  = { matched: false, uncertain: false, newChome: ctxChome };

  let p = part.trim();

  // ─── Step 1: 括弧内の「ただし〜を除く」例外節を先に抽出 ───
  const exceptions: string[] = [];
  const pStripped = p.replace(/[（(]ただし([^）)]+)[）)]/g, (_match, exc) => {
    exceptions.push(exc);
    return '';
  }).trim();

  // 括弧外の「ただし/除く/照会」はそのまま uncertain
  if (pStripped.includes('ただし') || pStripped.includes('除く') || pStripped.includes('照会')) {
    return UNCERTAIN;
  }

  // 例外節を除いたベースレンジを使う
  p = pStripped;

  // ─── Step 2: ベースレンジの照合 ───

  // 丁目範囲: "N丁目～M丁目"
  const chomeRangeM = p.match(/^(\d+)丁目～(\d+)丁目$/);
  if (chomeRangeM) {
    const from = parseInt(chomeRangeM[1], 10);
    const to   = parseInt(chomeRangeM[2], 10);
    if (addrChome === null) return UNCERTAIN;
    if (addrChome < from || addrChome > to) return NO_MATCH;
    // ベースマッチ → 例外確認へ
    const newChome = addrChome;
    return checkExceptions(exceptions, addrChome, addrBan, addrGo, true, false, newChome);
  }

  // 単独丁目（番地指定なし）: "N丁目"
  const chomeOnlyM = p.match(/^(\d+)丁目$/);
  if (chomeOnlyM) {
    const partChome = parseInt(chomeOnlyM[1], 10);
    if (addrChome === null) return UNCERTAIN;
    if (addrChome !== partChome) return NO_MATCH;
    return checkExceptions(exceptions, addrChome, addrBan, addrGo, true, false, partChome);
  }

  // 丁目+番地指定: "N丁目BanSpec"
  const chomeWithBanM = p.match(/^(\d+)丁目(.+)$/);
  let partChome: number | null = null;
  let banSpec = p;

  if (chomeWithBanM) {
    partChome = parseInt(chomeWithBanM[1], 10);
    banSpec   = chomeWithBanM[2].trim();
    if (addrChome !== null && addrChome !== partChome) {
      return { matched: false, uncertain: false, newChome: partChome };
    }
    if (addrChome === null) return UNCERTAIN;
  }

  const newChome = partChome ?? ctxChome;

  // 番地の括弧内 go 仕様を抽出
  let goSpec = '';
  const goInParenM = banSpec.match(/^(.*?)[(（]([^)）]+)[)）](.*)$/);
  if (goInParenM) {
    banSpec = (goInParenM[1] + (goInParenM[3] || '')).trim();
    goSpec  = goInParenM[2];
  }

  // 番地範囲: "N番～M番"
  const banRangeM = banSpec.match(/^(\d+)番～(\d+)番$/);
  if (banRangeM) {
    if (newChome !== null && addrChome !== null && newChome !== addrChome) {
      return { matched: false, uncertain: false, newChome };
    }
    const from = parseInt(banRangeM[1], 10);
    const to   = parseInt(banRangeM[2], 10);
    if (addrBan === null) return UNCERTAIN;
    if (addrBan < from || addrBan > to) return { matched: false, uncertain: false, newChome };
    if (goSpec) {
      const goMatch = matchGoRange(goSpec, addrGo);
      if (goMatch === null) return { matched: false, uncertain: true, newChome };
      if (!goMatch) return { matched: false, uncertain: false, newChome };
    }
    return checkExceptions(exceptions, addrChome, addrBan, addrGo, true, false, newChome);
  }

  // 単独番地: "N番"
  const banSingleM = banSpec.match(/^(\d+)番$/);
  if (banSingleM) {
    if (newChome !== null && addrChome !== null && newChome !== addrChome) {
      return { matched: false, uncertain: false, newChome };
    }
    const banNum = parseInt(banSingleM[1], 10);
    if (addrBan === null) return UNCERTAIN;
    if (addrBan !== banNum) return { matched: false, uncertain: false, newChome };
    if (goSpec) {
      const goMatch = matchGoRange(goSpec, addrGo);
      if (goMatch === null) return { matched: false, uncertain: true, newChome };
      if (!goMatch) return { matched: false, uncertain: false, newChome };
    }
    return checkExceptions(exceptions, addrChome, addrBan, addrGo, true, false, newChome);
  }

  if (/^\d+番地$/.test(banSpec) || /^\d+$/.test(banSpec)) return { matched: false, uncertain: true, newChome };

  // 「N番の一部」または複合 banSpec（"20番の一部 4丁目13番(21号～37号)" 等）
  // → uncertain だが、banSpec 内に埋め込まれた最後の丁目番号を newChome として伝播する
  if (banSpec.includes('の一部') || !banSpec.match(/^[\d番～号、 ]+$/)) {
    const embeddedChomes = [...banSpec.matchAll(/(\d+)丁目/g)];
    const lastEmbeddedChome = embeddedChomes.length > 0
      ? parseInt(embeddedChomes[embeddedChomes.length - 1][1], 10)
      : null;
    const finalNewChome = lastEmbeddedChome ?? newChome;
    return { matched: false, uncertain: true, newChome: finalNewChome };
  }

  return { matched: false, uncertain: true, newChome };
}

/**
 * ベースレンジがマッチした後、例外節を確認する
 */
function checkExceptions(
  exceptions: string[],
  chome: number | null,
  ban:   number | null,
  go:    number | null,
  baseMatched: boolean,
  baseUncertain: boolean,
  newChome: number | null,
): { matched: boolean; uncertain: boolean; newChome: number | null } {
  if (!baseMatched) return { matched: false, uncertain: baseUncertain, newChome };
  if (exceptions.length === 0) return { matched: true, uncertain: false, newChome };

  for (const exc of exceptions) {
    const excluded = isExcludedByClause(exc, chome, ban, go);
    if (excluded === true)  return { matched: false, uncertain: false, newChome }; // 除外確定 → no_match
    if (excluded === null)  return { matched: false, uncertain: true,  newChome }; // 判定不能 → uncertain
    // excluded === false → 除外されない → continue
  }
  // 全例外を確認、どれも除外しない → confirmed match
  return { matched: true, uncertain: false, newChome };
}

/**
 * 区域文字列と住所の丁目/番/号を照合する
 * @returns 'match' | 'no_match' | 'uncertain'
 */
export function matchRange(
  range: string,
  chome: number | null,
  ban:   number | null,
  go:    number | null = null,
): 'match' | 'no_match' | 'uncertain' {
  if (!range || range.trim() === '') return 'uncertain';

  // ※ フットノート（"※一部の詳細は〜照会のこと" 等）を除去
  const r = range.trim()
    .replace(/※[^\n\r]*照会[^\n\r]*/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!r) return 'uncertain';

  // 全域（例外なし）
  if (r === '全域') return 'match';

  // 全域（ただし...）
  if (r.startsWith('全域') || r.includes('全域')) {
    if (r.includes('ただし') || r.includes('除く') || r.includes('照会')) return 'uncertain';
    return 'match';
  }

  // ─── ただし例外節の先読み処理 ────────────────────────────────────────
  // 「N丁目～M丁目（ただし、P丁目Q番の一部を除く）」パターンに限定して確定判定する。
  // 「の一部」を含む場合のみ対象（ban範囲除外は blanket uncertain に任せる）
  const chomeRangeWithTadashiM = r.match(/^(\d+)丁目～(\d+)丁目[（(]ただし、(\d+)丁目(\d+)番の一部/);
  if (chomeRangeWithTadashiM && chome !== null) {
    const from     = parseInt(chomeRangeWithTadashiM[1], 10);
    const to       = parseInt(chomeRangeWithTadashiM[2], 10);
    const excChome = parseInt(chomeRangeWithTadashiM[3], 10);
    const excBan   = parseInt(chomeRangeWithTadashiM[4], 10);
    if (chome >= from && chome <= to) {
      if (chome !== excChome) {
        return 'match'; // 例外丁目ではない → confirmed
      }
      if (ban !== null && ban !== excBan) {
        return 'match'; // 例外番地ではない → confirmed
      }
      return 'uncertain'; // 例外番地「の一部」の可能性あり
    }
    // 範囲外 → 下の処理へ
  }

  // ただし/除く/照会 を含む → uncertain（その他のケース）
  if (r.includes('ただし') || r.includes('除く') || r.includes('照会')) return 'uncertain';

  // パーツに分割して個別チェック
  const parts = splitRangeParts(r);
  let hasUncertain = false;
  let ctxChome: number | null = null;

  for (const part of parts) {
    const res = matchPart(part, chome, ban, go, ctxChome);

    // chome コンテキストを更新
    if (res.newChome !== null) ctxChome = res.newChome;

    if (res.matched)    return 'match';
    if (res.uncertain)  hasUncertain = true;
  }

  return hasUncertain ? 'uncertain' : 'no_match';
}

// -----------------------------------------------------------------------
// 学区照合
// -----------------------------------------------------------------------
export interface SchoolLookupResult {
  elementary:  string;
  juniorHigh:  string;
  ward:        string;
  town:        string;
  confidence:  'confirmed' | 'uncertain';
}

/**
 * 住所から福岡市の学区を照合する
 */
export function lookupFukuokaSchool(address: string): SchoolLookupResult | null {
  const map    = loadSchoolAddressMap();
  const records: any[] = map.records || [];
  if (!records.length) return null;

  const parsed = parseAddress(address);
  if (!parsed.ward || !parsed.town) return null;

  // 表記揺れ対応（末尾に「町」付加）
  const townCandidates = [
    parsed.town,
    ...(parsed.town.endsWith('町') ? [] : [parsed.town + '町']),
  ];

  for (const town of townCandidates) {
    const candidates = records.filter(
      (r: any) => r.ward === parsed.ward && r.town === town,
    );
    if (!candidates.length) continue;

    let bestMatch:     { record: any; confidence: 'confirmed' | 'uncertain' } | null = null;
    let uncertainFall: { record: any; confidence: 'confident' | 'uncertain' } | null = null;

    for (const rec of candidates) {
      const result = matchRange(rec.range, parsed.chome, parsed.ban, parsed.go);

      if (result === 'match') {
        bestMatch = { record: rec, confidence: 'confirmed' };
        break; // 確定 → 即時返却
      }
      if (result === 'uncertain' && !uncertainFall) {
        uncertainFall = { record: rec, confidence: 'uncertain' };
      }
    }

    if (bestMatch) {
      return {
        elementary: bestMatch.record.elementary,
        juniorHigh: bestMatch.record.juniorHigh,
        ward:       bestMatch.record.ward,
        town:       bestMatch.record.town,
        confidence: bestMatch.confidence,
      };
    }
    if (uncertainFall) {
      return {
        elementary: (uncertainFall as any).record.elementary,
        juniorHigh: (uncertainFall as any).record.juniorHigh,
        ward:       (uncertainFall as any).record.ward,
        town:       (uncertainFall as any).record.town,
        confidence: 'uncertain',
      };
    }
  }

  return null; // ヒットなし → GeoJSON フォールバック
}
