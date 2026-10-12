/**
 * EStatBuildingStatsService
 *
 * 国土交通省「建築着工統計調査」の e-Stat API から
 * 建築年別・構造別の建築単価を取得・計算するサービス。
 *
 * ─ データセット ─────────────────────────────────────────────────────────────
 * statsDataId: 0003114547
 * 表題: 「建築物着工統計 3 用途別、構造別／建築物の数、床面積、工事費予定額（年次）」
 *
 * ─ 分類コード ────────────────────────────────────────────────────────────────
 * tab  (表章項目): 12=建築物の数, 13=床面積[m²], 14=工事費予定額[万円]
 * cat01(構造):     11=計, 12=木造, 13=SRC, 14=RC, 15=鉄骨造, 16=CB, 17=その他
 * cat02(用途):     11=計(全用途), 12=居住専用住宅
 * area (都道府県): 00000=全国, 40000=福岡県, 44000=大分県
 * time (年次):     YYYY000000 形式
 *
 * ─ 単価換算公式（実証済み）───────────────────────────────────────────────────
 * 単価[円/m²] = 工事費_万円 × 10,000 / 床面積_m²
 *
 * ─ 年度範囲 ──────────────────────────────────────────────────────────────────
 * 2011年〜現在 (1965〜2010年は NTA 公表値のみ)
 *
 * ─ e-Stat API と NTA 建物標準的な建築価額表の関係 ───────────────────────────
 * NTA の建物標準建築価額表は、e-Stat の 0003114547 (全用途・全国) を元データとして
 * 算出したもの。差異は丸め誤差のみ（±100円以内）。
 * ⚠️ 軽量鉄骨造 (軽量鉄骨) は e-Stat に独立列なし。鉄骨造の派生値として算出する。
 */

import axios from 'axios';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

/** e-Stat から取得した構造別の生データ */
export interface EStatStructureData {
  floorArea_m2: number;          // 床面積 [m²]
  constructionCost_manyen: number; // 工事費予定額 [万円]
  unitPrice_yen_per_m2: number;  // 単価 [円/m²] = cost × 10000 / area
  buildingCount: number;         // 建築物の数 [棟]
}

/** e-Stat から取得した単年度の全構造データ */
export interface EStatYearlyResult {
  year: number;
  usageType: 'all' | 'residential'; // 11=全用途, 12=居住専用住宅
  fetchedAt: Date;
  availableYears: number[];     // このAPIで利用可能な全年度
  structures: {
    木造:                 EStatStructureData;
    SRC:                  EStatStructureData; // 鉄骨鉄筋コンクリート造
    RC:                   EStatStructureData; // 鉄筋コンクリート造
    鉄骨:                 EStatStructureData; // 鉄骨造（軽量+重量を含む）
  };
}

/** e-Stat の API レスポンス行 */
interface EStatApiRow {
  '@tab': string;
  '@cat01': string;
  '@cat02': string;
  '@area': string;
  '@time': string;
  '@unit': string;
  '$': string;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const ESTAT_API_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json';
const STATS_DATA_ID  = '0003114547';

/** cat02: 用途コード */
const USAGE_CODES = {
  all:         '11', // 全用途合計
  residential: '12', // 居住専用住宅
} as const;

/** cat01: 構造コード（e-Stat） */
const STRUCTURE_CODES = {
  '12': '木造',
  '13': 'SRC',
  '14': 'RC',
  '15': '鉄骨',
} as const;

// ─── サービスクラス ───────────────────────────────────────────────────────────

export class EStatBuildingStatsService {
  private readonly appId: string;

  constructor() {
    const id = process.env.ESTAT_APP_ID;
    if (!id) throw new Error('ESTAT_APP_ID が .env に設定されていません');
    this.appId = id;
  }

  /**
   * e-Stat API で利用可能な年度一覧を取得
   */
  async fetchAvailableYears(): Promise<number[]> {
    const url = `${ESTAT_API_BASE}/getMetaInfo`;
    const res = await axios.get(url, {
      params: { appId: this.appId, statsDataId: STATS_DATA_ID, lang: 'J' },
      timeout: 15000,
    });
    const classObjs = res.data.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ as any[];
    const timeClass = classObjs.find((c: any) => c['@id'] === 'time');
    const items = Array.isArray(timeClass.CLASS) ? timeClass.CLASS : [timeClass.CLASS];
    return items
      .map((t: any) => parseInt(t['@code'].replace('000000', ''), 10))
      .filter((y: number) => !isNaN(y))
      .sort((a: number, b: number) => b - a); // 新しい順
  }

  /**
   * 指定年度の構造別建築単価を取得
   *
   * @param year       対象年度（例: 2023）
   * @param usageType  'all'=全用途(NTA相当) | 'residential'=居住専用住宅
   * @param area       'all'=全国 | '福岡県' | '大分県'
   */
  async fetchYearlyData(
    year: number,
    usageType: 'all' | 'residential' = 'all',
    area: 'all' | '福岡県' | '大分県' = 'all',
  ): Promise<EStatYearlyResult> {
    const areaCode = { all: '00000', '福岡県': '40000', '大分県': '44000' }[area];
    const catCode  = USAGE_CODES[usageType];
    const timeCode = `${year}000000`;

    const url = `${ESTAT_API_BASE}/getStatsData`;
    const res = await axios.get(url, {
      params: {
        appId:       this.appId,
        statsDataId: STATS_DATA_ID,
        cdArea:      areaCode,
        cdCat02:     catCode,
        cdTime:      timeCode,
        lang:        'J',
        limit:       500,
      },
      timeout: 20000,
    });

    const rows: EStatApiRow[] =
      res.data.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE;

    if (!rows || rows.length === 0) {
      throw new Error(`e-Stat: ${year}年のデータが見つかりません (area=${area}, usage=${usageType})`);
    }

    // 構造 × 指標 のマップを作成
    type RowMap = Record<string, Record<string, number>>;
    const map: RowMap = {};
    for (const row of rows) {
      const structCode = row['@cat01'];
      const tabCode    = row['@tab'];
      if (!map[structCode]) map[structCode] = {};
      map[structCode][tabCode] = parseFloat(row['$']) || 0;
    }

    // 構造ごとに単価を計算
    const calcStructure = (code: string): EStatStructureData => {
      const d = map[code] ?? {};
      const area_m2     = d['13'] ?? 0; // 床面積 [m²]
      const cost_manyen = d['14'] ?? 0; // 工事費予定額 [万円]
      const count       = d['12'] ?? 0; // 建築物数 [棟]
      const unit_price  = area_m2 > 0
        ? Math.round((cost_manyen * 10_000) / area_m2)
        : 0;
      return { floorArea_m2: area_m2, constructionCost_manyen: cost_manyen, unitPrice_yen_per_m2: unit_price, buildingCount: count };
    };

    const availableYears = await this.fetchAvailableYears();

    return {
      year,
      usageType,
      fetchedAt: new Date(),
      availableYears,
      structures: {
        木造: calcStructure('12'),
        SRC:  calcStructure('13'),
        RC:   calcStructure('14'),
        鉄骨: calcStructure('15'),
      },
    };
  }

  /**
   * 軽量鉄骨の単価を推計する
   *
   * e-Stat に軽量鉄骨の独立した区分はない。
   * 国税庁も NTA 表には軽量鉄骨列がなく、鉄骨造として扱う。
   * 本実装では coefficient（デフォルト 1.0）を適用した推計値として返す。
   *
   * @param steelPrice   鉄骨造の単価 [円/m²]
   * @param coefficient  軽量鉄骨係数（デフォルト 1.0）
   * @returns 軽量鉄骨推計単価 [円/m²]
   */
  estimateLightSteelPrice(steelPrice: number, coefficient = 1.0): number {
    return Math.round(steelPrice * coefficient);
  }

  /**
   * 年度の利用可否チェック（API から取得できるか）
   */
  async isYearAvailable(year: number): Promise<boolean> {
    const years = await this.fetchAvailableYears();
    return years.includes(year);
  }
}

export const eStatBuildingStatsService = new EStatBuildingStatsService();
