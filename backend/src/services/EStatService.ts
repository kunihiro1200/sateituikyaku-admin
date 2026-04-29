/**
 * e-Stat API サービス
 * 政府統計（国勢調査・住民基本台帳）から人口データを取得する
 */

import axios from 'axios';

const ESTAT_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json';

// 国勢調査の statsDataId（市区町村別人口総数）
// 各年の「人口総数」テーブルID
const CENSUS_STATS_IDS: Record<string, string> = {
  '2020': '0003445078',
  '2015': '0003169840',
  '2010': '0003124350',
};

// 都道府県コード → 市区町村コードのマッピング（主要都市）
// e-Stat の地域コードは5桁（都道府県2桁 + 市区町村3桁）
const PREF_CODES: Record<string, string> = {
  '北海道': '01', '青森県': '02', '岩手県': '03', '宮城県': '04', '秋田県': '05',
  '山形県': '06', '福島県': '07', '茨城県': '08', '栃木県': '09', '群馬県': '10',
  '埼玉県': '11', '千葉県': '12', '東京都': '13', '神奈川県': '14', '新潟県': '15',
  '富山県': '16', '石川県': '17', '福井県': '18', '山梨県': '19', '長野県': '20',
  '岐阜県': '21', '静岡県': '22', '愛知県': '23', '三重県': '24', '滋賀県': '25',
  '京都府': '26', '大阪府': '27', '兵庫県': '28', '奈良県': '29', '和歌山県': '30',
  '鳥取県': '31', '島根県': '32', '岡山県': '33', '広島県': '34', '山口県': '35',
  '徳島県': '36', '香川県': '37', '愛媛県': '38', '高知県': '39', '福岡県': '40',
  '佐賀県': '41', '長崎県': '42', '熊本県': '43', '大分県': '44', '宮崎県': '45',
  '鹿児島県': '46', '沖縄県': '47',
};

// 主要市区町村コード（都道府県コード + 市区町村コード）
// 大分県の主要市
const CITY_CODES: Record<string, string> = {
  '大分市': '44201',
  '別府市': '44202',
  '中津市': '44203',
  '日田市': '44204',
  '佐伯市': '44205',
  '臼杵市': '44206',
  '津久見市': '44207',
  '竹田市': '44208',
  '豊後高田市': '44209',
  '杵築市': '44210',
  '宇佐市': '44211',
  '豊後大野市': '44212',
  '由布市': '44213',
  '国東市': '44214',
};

export interface PopulationData {
  year: string;
  city: number;   // 市全体の人口
  area: number;   // エリア推定人口（市の人口 × エリア比率）
}

/**
 * 市名から e-Stat の地域コードを取得する
 */
function getCityCode(cityName: string): string | null {
  // 直接マッチ
  if (CITY_CODES[cityName]) return CITY_CODES[cityName];

  // 「市」「区」「町」「村」を含む場合の部分マッチ
  for (const [name, code] of Object.entries(CITY_CODES)) {
    if (cityName.includes(name) || name.includes(cityName)) return code;
  }
  return null;
}

/**
 * 国勢調査から市区町村の人口を取得する
 * @param cityCode e-Stat地域コード（例: '44201'）
 * @param statsDataId 統計テーブルID
 * @param year 年（ログ用）
 */
async function fetchCensusPopulation(
  cityCode: string,
  statsDataId: string,
  year: string,
  appId: string
): Promise<number | null> {
  try {
    const url = `${ESTAT_BASE}/getStatsData?appId=${appId}&statsDataId=${statsDataId}&cdArea=${cityCode}&limit=5`;
    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;

    const status = data?.GET_STATS_DATA?.RESULT?.STATUS;
    if (status !== 0) return null;

    let values = data?.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!values) return null;
    if (!Array.isArray(values)) values = [values];

    // 人口総数（男女合計）を探す
    // cat01が '0'（総数）または '00010'（総数）のものを優先
    const totalEntry = values.find((v: any) =>
      (v['@cat01'] === '0' || v['@cat01'] === '00010') &&
      (!v['@cat02'] || v['@cat02'] === '0000' || v['@cat02'] === '000') &&
      (!v['@cat03'] || v['@cat03'] === '0000' || v['@cat03'] === '000')
    ) || values[0];

    const pop = parseInt(totalEntry?.['$'] || '0', 10);
    return pop > 0 ? pop : null;
  } catch (e) {
    console.warn(`[EStatService] fetchCensusPopulation error (${year}):`, e);
    return null;
  }
}

/**
 * 市区町村の人口推移データを取得する
 * 国勢調査（2010, 2015, 2020年）+ 推計値（2024, 2025年）
 */
export async function fetchPopulationData(
  cityName: string,
  areaRatio: number = 0.05  // エリアが市全体に占める割合の推定（デフォルト5%）
): Promise<PopulationData[] | null> {
  const appId = process.env.ESTAT_APP_ID;
  if (!appId) {
    console.warn('[EStatService] ESTAT_APP_ID not set');
    return null;
  }

  const cityCode = getCityCode(cityName);
  if (!cityCode) {
    console.warn(`[EStatService] city code not found for: ${cityName}`);
    return null;
  }

  console.log(`[EStatService] fetching population for ${cityName} (${cityCode})`);

  // 国勢調査データを並列取得
  const [pop2020, pop2015, pop2010] = await Promise.all([
    fetchCensusPopulation(cityCode, CENSUS_STATS_IDS['2020'], '2020', appId),
    fetchCensusPopulation(cityCode, CENSUS_STATS_IDS['2015'], '2015', appId),
    fetchCensusPopulation(cityCode, CENSUS_STATS_IDS['2010'], '2010', appId),
  ]);

  if (!pop2020 || !pop2015) {
    console.warn(`[EStatService] insufficient data for ${cityName}`);
    return null;
  }

  // 2020→2025の変化率から2024・2025を推計
  const changeRate2015to2020 = pop2020 / (pop2015 || pop2020);
  // 直近5年の変化率を年率に換算して2024・2025を推計
  const annualRate = Math.pow(changeRate2015to2020, 1 / 5);
  const pop2024 = Math.round(pop2020 * Math.pow(annualRate, 4));
  const pop2025 = Math.round(pop2020 * Math.pow(annualRate, 5));

  const result: PopulationData[] = [
    { year: '2015年', city: pop2015, area: Math.round(pop2015 * areaRatio) },
    { year: '2018年', city: Math.round(pop2015 + (pop2020 - pop2015) * 0.6), area: 0 },
    { year: '2021年', city: Math.round(pop2020 * Math.pow(annualRate, 1)), area: 0 },
    { year: '2024年', city: pop2024, area: 0 },
    { year: '2025年', city: pop2025, area: 0 },
  ];

  // areaの値を設定（市全体 × エリア比率）
  result.forEach(r => {
    if (r.area === 0) r.area = Math.round(r.city * areaRatio);
  });

  console.log(`[EStatService] population data for ${cityName}:`, result.map(r => `${r.year}:${r.city}`).join(', '));
  return result;
}

/**
 * 市名からエリア比率を推定する
 * 町名の規模感から大まかな比率を返す
 */
export function estimateAreaRatio(cityName: string, townName: string): number {
  // 大都市ほど1エリアの比率は小さい
  const bigCities = ['大阪市', '名古屋市', '横浜市', '福岡市', '札幌市', '仙台市', '広島市', '京都市'];
  const midCities = ['大分市', '別府市', '熊本市', '長崎市', '鹿児島市', '宮崎市', '佐賀市'];

  if (bigCities.some(c => cityName.includes(c))) return 0.02;
  if (midCities.some(c => cityName.includes(c))) return 0.04;
  return 0.06; // 小都市
}
