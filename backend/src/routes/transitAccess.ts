/**
 * 交通アクセス自動取得 API
 *
 * Google Maps Places API（旧版 nearbysearch）で最寄り駅・バス停を検索し、
 * Directions API で徒歩道路距離を取得して seller_transit_access テーブルに保存する。
 *
 * ─── 旧版 Places API について ───────────────────────────────────────────────
 * 現在、nearbyMap.ts と同じ旧版 Places API (nearbysearch) を使用している。
 * 将来 New Places API に移行する場合は callOldPlacesNearbysearch() 関数のみを
 * 差し替えること。他のロジック（FI判定・距離計算・DB保存）は変更不要。
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── Google Maps 利用規約 ────────────────────────────────────────────────────
 * Places API レスポンスの DB 保存（キャッシュ）は許可されている。
 * ただし場所データの再表示は 30 日以内が許容範囲。
 * fetched_at カラムで経過日数を管理し、フロントエンドで 30 日超過時に警告を表示する。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// ──────────────────────────────────────────────
// 型・定数
// ──────────────────────────────────────────────

type StoreType = 'fukuoka' | 'oita' | 'unknown';
type TransportType = 'station' | 'bus_stop';

interface FetchCount {
  station: number;
  bus_stop: number;
}

/** 店舗ごとの最大取得件数 */
const FETCH_COUNT: Record<Exclude<StoreType, 'unknown'>, FetchCount> = {
  fukuoka: { station: 3, bus_stop: 3 },
  oita:    { station: 1, bus_stop: 1 },
};

/** 駅の検索半径（m）。候補が 0 件なら次の半径を試みる */
const STATION_SEARCH_RADII = [2000, 3000];

/** バス停の検索半径（m）。候補が 0 件なら次の半径を試みる */
const BUS_STOP_SEARCH_RADII = [1000, 2000, 3000];

interface PlaceCandidate {
  name: string;
  place_id: string;
  place_lat: number;
  place_lng: number;
}

// ──────────────────────────────────────────────
// ヘルパー関数
// ──────────────────────────────────────────────

/** seller_number から店舗を判定する（大文字小文字不問） */
function detectStore(sellerNumber: string | null | undefined): StoreType {
  if (!sellerNumber || sellerNumber.trim() === '') return 'unknown';
  return /fi/i.test(sellerNumber) ? 'fukuoka' : 'oita';
}

/** 徒歩道路距離（m）から広告用徒歩分数を算出（80m/分・端数切り上げ） */
function calcWalkMinutes(distanceMeters: number): number {
  return Math.ceil(distanceMeters / 80);
}

/** 2点間の直線距離をハーバーサイン法で算出（m）*/
function calcStraightDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ──────────────────────────────────────────────
// 博多駅への transit 情報取得（FI売主向け）
// ──────────────────────────────────────────────

/** 博多駅の座標（JR・地下鉄共通出入口付近） */
const HAKATA_STATION = { lat: 33.58975, lng: 130.42006 };

/** 翌営業日の朝 9 時のタイムスタンプを返す（transit API は未来の時刻が必要） */
function getNextWeekdayMorningTs(): number {
  const now = new Date();
  const next = new Date(now);
  const day = now.getDay(); // 0=日 6=土
  const addDays = day === 0 ? 1 : day === 6 ? 2 : 1;
  next.setDate(now.getDate() + addDays);
  next.setHours(9, 0, 0, 0);
  return Math.floor(next.getTime() / 1000);
}

/**
 * Directions API (transit) を使って駅→博多駅の経路情報を取得する。
 * - lineName: 出発駅で乗車する路線名（例: 地下鉄七隈線）
 * - minutesToHakata: 博多駅までの所要分数
 * - routeText: "七隈線直通 博多まで10分" / "西鉄→天神で空港線乗換→博多まで25分"
 */
async function fetchTransitToHakata(
  stationLat: number,
  stationLng: number,
  apiKey: string
): Promise<{
  lineName: string | null;
  minutesToHakata: number | null;
  routeText: string | null;
}> {
  try {
    const departureTime = getNextWeekdayMorningTs();
    console.log(`[transitAccess/hakata] calling transit API lat=${stationLat} lng=${stationLng} departure=${new Date(departureTime * 1000).toISOString()}`);

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: `${stationLat},${stationLng}`,
          destination: `${HAKATA_STATION.lat},${HAKATA_STATION.lng}`,
          mode: 'transit',
          departure_time: departureTime,
          language: 'ja',
          key: apiKey,
        },
        timeout: 12000,
      }
    );

    const status: string = response.data.status;
    console.log(`[transitAccess/hakata] status=${status} error_message=${response.data.error_message ?? ''} routes=${response.data.routes?.length ?? 0}`);

    if (status !== 'OK' || !response.data.routes?.[0]?.legs?.[0]) {
      // 診断用: エラー理由を routeText に格納して UI に表示
      const reason = response.data.error_message
        ? `${status}: ${response.data.error_message}`
        : `status=${status}`;
      return { lineName: null, minutesToHakata: null, routeText: `[取得失敗] ${reason}` };
    }

    const leg = response.data.routes[0].legs[0];
    const totalMinutes = Math.ceil(leg.duration.value / 60);

    // TRANSIT ステップのみ抽出（WALKING ステップを除く）
    const transitSteps: any[] = (leg.steps as any[]).filter(
      (s: any) => s.travel_mode === 'TRANSIT'
    );

    console.log(`[transitAccess/hakata] totalMinutes=${totalMinutes} transitSteps=${transitSteps.length}`);
    if (transitSteps.length > 0) {
      console.log(`[transitAccess/hakata] first line=`, JSON.stringify(transitSteps[0].transit_details?.line));
    }

    if (transitSteps.length === 0) {
      return { lineName: null, minutesToHakata: totalMinutes, routeText: `博多まで${totalMinutes}分` };
    }

    // 最初に乗る路線名
    const firstStep = transitSteps[0];
    const firstLineName: string =
      firstStep.transit_details?.line?.name ||
      firstStep.transit_details?.line?.short_name ||
      '';

    if (transitSteps.length === 1) {
      // 乗り換えなし
      const routeText = firstLineName
        ? `${firstLineName}直通 博多まで${totalMinutes}分`
        : `博多まで${totalMinutes}分`;
      return { lineName: firstLineName || null, minutesToHakata: totalMinutes, routeText };
    } else {
      // 乗り換えあり
      const transfers = transitSteps
        .slice(1)
        .map((s: any) => {
          const depStop: string = s.transit_details?.departure_stop?.name ?? '';
          const lineName: string =
            s.transit_details?.line?.name ||
            s.transit_details?.line?.short_name ||
            '';
          return depStop ? `${depStop}で${lineName}乗換` : `${lineName}乗換`;
        })
        .join('→');
      const routeText = `${firstLineName}→${transfers}→博多まで${totalMinutes}分`;
      return { lineName: firstLineName || null, minutesToHakata: totalMinutes, routeText };
    }
  } catch (err: any) {
    console.error('[transitAccess/hakata] exception:', err.message);
    return { lineName: null, minutesToHakata: null, routeText: `[例外] ${err.message}` };
  }
}

/**
 * Directions API で徒歩道路距離を取得する。
 * API が利用できない場合は直線距離 × 1.3 で推定する（isEstimated=true）。
 * nearbyMap.ts の fetchWalkingDistance() と同じ実装。
 */
async function fetchWalkingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<{ meters: number; isEstimated: boolean }> {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: `${originLat},${originLng}`,
          destination: `${destLat},${destLng}`,
          mode: 'walking',
          language: 'ja',
          key: apiKey,
        },
        timeout: 10000,
      }
    );
    if (response.data.status === 'OK' && response.data.routes?.[0]?.legs?.[0]) {
      return { meters: response.data.routes[0].legs[0].distance.value, isEstimated: false };
    }
    console.warn('[transitAccess] Directions API status:', response.data.status, '→ 推定値にフォールバック');
  } catch (err: any) {
    console.warn('[transitAccess] Directions API error:', err.message, '→ 推定値にフォールバック');
  }
  const straight = calcStraightDistance(originLat, originLng, destLat, destLng);
  return { meters: Math.round(straight * 1.3), isEstimated: true };
}

/**
 * 旧版 Places Nearby Search API を呼び出す。
 * ⚠️ 将来 New Places API に移行する場合はこの関数のみを差し替えること。
 * nearbyMap.ts の実装と同じ API バージョン・パラメータを使用。
 */
async function callOldPlacesNearbysearch(
  lat: number,
  lng: number,
  radius: number,
  placeType: string,
  keyword: string | undefined,
  apiKey: string
): Promise<any[]> {
  const params: Record<string, any> = {
    location: `${lat},${lng}`,
    radius,
    type: placeType,
    language: 'ja',
    key: apiKey,
  };
  if (keyword) params.keyword = keyword;

  const response = await axios.get(
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
    { params, timeout: 12000 }
  );

  const status: string = response.data.status;
  if (status === 'OK' && response.data.results?.length > 0) {
    return response.data.results as any[];
  }
  if (status === 'ZERO_RESULTS') return [];

  console.warn('[transitAccess] Places API status:', status, `type=${placeType} radius=${radius}`);
  return [];
}

/**
 * 駅を検索する（半径自動拡大付き）。
 * transit_station タイプで電車・地下鉄を網羅し、バス停タイプのみの結果を除外する。
 */
async function searchStations(
  lat: number,
  lng: number,
  maxCandidates: number,
  apiKey: string
): Promise<PlaceCandidate[]> {
  for (const radius of STATION_SEARCH_RADII) {
    const raw = await callOldPlacesNearbysearch(lat, lng, radius, 'transit_station', '駅', apiKey);

    // バス停タイプのみ（train_station / subway_station を含まない）を除外
    const filtered = raw.filter((p: any) => {
      const types: string[] = p.types ?? [];
      if (
        types.includes('bus_station') &&
        !types.includes('train_station') &&
        !types.includes('subway_station')
      ) {
        return false;
      }
      return true;
    });

    if (filtered.length > 0) {
      return filtered.slice(0, maxCandidates * 3).map((p: any) => ({
        name: p.name as string,
        place_id: p.place_id as string,
        place_lat: p.geometry.location.lat as number,
        place_lng: p.geometry.location.lng as number,
      }));
    }
    // 0 件なら次の半径で再試行
  }
  return [];
}

/**
 * バス停を検索する（半径自動拡大付き）。
 * 1,000m → 2,000m → 3,000m の順に拡大し、1 件でも見つかった時点で返す。
 *
 * 検索戦略:
 *   bus_station タイプは大規模バスターミナルを優先してしまうため使用しない。
 *   代わりに transit_station + keyword='バス停' で個別バス停を検索し、
 *   名前に「バス停」を含む結果を優先し、バスターミナルを後回しにする。
 *   それでも見つからない場合のみ bus_station タイプにフォールバックする。
 */
async function searchBusStops(
  lat: number,
  lng: number,
  maxCandidates: number,
  apiKey: string
): Promise<PlaceCandidate[]> {
  for (const radius of BUS_STOP_SEARCH_RADII) {
    // ── フェーズ1: transit_station + keyword='バス停'（個別バス停を優先）──
    const raw = await callOldPlacesNearbysearch(lat, lng, radius, 'transit_station', 'バス停', apiKey);

    if (raw.length > 0) {
      // 名前に「バス停」を含むものを優先し、「ターミナル」は後回し
      const withBusStop = raw.filter((p: any) => /バス停/.test(p.name ?? ''));
      const others = raw.filter((p: any) => !/バス停/.test(p.name ?? ''));
      const sorted = [...withBusStop, ...others];

      return sorted.slice(0, maxCandidates * 3).map((p: any) => ({
        name: p.name as string,
        place_id: p.place_id as string,
        place_lat: p.geometry.location.lat as number,
        place_lng: p.geometry.location.lng as number,
      }));
    }

    // ── フェーズ2: フォールバック（bus_station タイプで再検索）────────────
    // transit_station で 0 件の場合のみ実行。ターミナルが返る可能性があるが
    // 近くにバス停がない場合の最終手段として使用する。
    const fallback = await callOldPlacesNearbysearch(lat, lng, radius, 'bus_station', undefined, apiKey);
    if (fallback.length > 0) {
      return fallback.slice(0, maxCandidates * 3).map((p: any) => ({
        name: p.name as string,
        place_id: p.place_id as string,
        place_lat: p.geometry.location.lat as number,
        place_lng: p.geometry.location.lng as number,
      }));
    }
    // 両方 0 件なら次の半径で再試行
  }
  return [];
}

// ──────────────────────────────────────────────
// 重複除去: 距離ソート済みリストから同名を除く（最短距離を優先）
// バス停は「清水町（バス）」「清水町」のように名称のコアが同じ場合も除去
// ──────────────────────────────────────────────

function normalizeName(name: string): string {
  // 括弧内の補足を除去して正規化: 「清水町（バス）」→「清水町」
  return name.replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, '').trim();
}

type WithDistance = {
  transportType: TransportType;
  candidate: PlaceCandidate;
  meters: number;
  isEstimated: boolean;
};

function deduplicateByName(sorted: WithDistance[]): WithDistance[] {
  const seen = new Map<string, boolean>();
  return sorted.filter(item => {
    const norm = normalizeName(item.candidate.name);
    if (seen.has(norm)) return false;
    seen.set(norm, true);
    return true;
  });
}


// 保存済み交通アクセス情報を返す（なければ空配列）
// ──────────────────────────────────────────────

router.get('/seller/:sellerNumber', async (req: Request, res: Response) => {
  const { sellerNumber } = req.params;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('seller_transit_access')
      .select('*')
      .eq('seller_number', sellerNumber)
      .order('transport_type', { ascending: true }) // bus_stop → station の辞書順
      .order('rank', { ascending: true });

    if (error) {
      console.error('[transitAccess/GET] supabase error:', error);
      return res.status(500).json({ error: '交通アクセス情報の読み込みに失敗しました' });
    }

    return res.json({ data: data ?? [] });
  } catch (err: any) {
    console.error('[transitAccess/GET] error:', err?.message);
    return res.status(500).json({ error: '交通アクセス情報の読み込みに失敗しました' });
  }
});

// ──────────────────────────────────────────────
// POST /api/transit-access/seller/:sellerNumber/fetch
// Google Maps API から取得して DB に保存
// ──────────────────────────────────────────────

router.post('/seller/:sellerNumber/fetch', async (req: Request, res: Response) => {
  const { sellerNumber } = req.params;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY が設定されていません。' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    // sellers テーブルから座標を取得
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('latitude, longitude')
      .eq('seller_number', sellerNumber)
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({ error: '売主が見つかりません' });
    }

    const lat: number | null = seller.latitude;
    const lng: number | null = seller.longitude;

    if (lat == null || lng == null) {
      return res.status(422).json({
        error: '物件の座標が未設定です。地図セクションで「再ジオコーディング」を実行してから再試行してください。',
      });
    }

    // 店舗判定
    const storeType = detectStore(sellerNumber);
    if (storeType === 'unknown') {
      return res.status(422).json({
        error: '売主番号が未設定のため店舗判定ができません。売主番号を設定してから再試行してください。',
      });
    }

    const counts = FETCH_COUNT[storeType];
    console.log(`[transitAccess] fetching for ${sellerNumber} (${storeType}) lat=${lat} lng=${lng}`);

    // ─── 既存の is_selected / 手動修正 / 確認状況を退避（再取得時に上書きしない）──
    const { data: existingRows } = await supabase
      .from('seller_transit_access')
      .select(
        'transport_type, rank, is_selected, is_manually_corrected, manual_name, manual_line_name, manual_walk_minutes, is_confirmed, confirmed_at'
      )
      .eq('seller_number', sellerNumber);

    const existingMap = new Map<string, any>();
    for (const row of existingRows ?? []) {
      existingMap.set(`${row.transport_type}_${row.rank}`, row);
    }

    // ─── 駅・バス停を並列検索 ───────────────────────────────────────────────
    const [stationCandidates, busStopCandidates] = await Promise.all([
      searchStations(lat, lng, counts.station, apiKey),
      searchBusStops(lat, lng, counts.bus_stop, apiKey),
    ]);

    // ─── 各候補の徒歩道路距離を並列取得（Directions API）──────────────────
    const allCandidatesFlat: Array<{ transportType: TransportType; candidate: PlaceCandidate }> = [
      ...stationCandidates.map(c => ({ transportType: 'station' as TransportType, candidate: c })),
      ...busStopCandidates.map(c => ({ transportType: 'bus_stop' as TransportType, candidate: c })),
    ];

    const distanceResults = await Promise.all(
      allCandidatesFlat.map(({ candidate }) =>
        fetchWalkingDistance(lat, lng, candidate.place_lat, candidate.place_lng, apiKey)
      )
    );

    // ─── 道路距離順にソートして上位 N 件を選定（同名重複を除去）───────────
    const stationsWithDist: WithDistance[] = [];
    const busStopsWithDist: WithDistance[] = [];

    for (let i = 0; i < allCandidatesFlat.length; i++) {
      const { transportType, candidate } = allCandidatesFlat[i];
      const { meters, isEstimated } = distanceResults[i];
      const item: WithDistance = { transportType, candidate, meters, isEstimated };
      if (transportType === 'station') {
        stationsWithDist.push(item);
      } else {
        busStopsWithDist.push(item);
      }
    }

    stationsWithDist.sort((a, b) => a.meters - b.meters);
    busStopsWithDist.sort((a, b) => a.meters - b.meters);

    // ─── 同名重複除去 → rank1は常に含め rank2以降は徒歩30分未満のみ ────
    const WALK_LIMIT_MINUTES = 30; // 2件目以降: 30分以上は入力不要

    const filterByRank = (items: WithDistance[], maxCount: number): WithDistance[] => {
      const result: WithDistance[] = [];
      for (let i = 0; i < items.length && result.length < maxCount; i++) {
        const walkMins = calcWalkMinutes(items[i].meters);
        // rank1（最近接）は距離に関係なく常に含める
        // rank2以降は30分未満のものだけ含める
        if (i === 0 || walkMins < WALK_LIMIT_MINUTES) {
          result.push(items[i]);
        }
      }
      return result;
    };

    const topStations = filterByRank(deduplicateByName(stationsWithDist), counts.station);
    const topBusStops = filterByRank(deduplicateByName(busStopsWithDist), counts.bus_stop);

    // ─── DB に upsert 保存 ────────────────────────────────────────────────
    const now = new Date().toISOString();
    const upsertRows: any[] = [];

    // ─── FI売主（福岡）の駅のみ博多駅への transit 情報を取得 ──────────────
    type HakataInfo = { lineName: string | null; minutesToHakata: number | null; routeText: string | null };
    let stationHakataInfos: HakataInfo[] = topStations.map(() => ({
      lineName: null, minutesToHakata: null, routeText: null,
    }));

    if (storeType === 'fukuoka' && topStations.length > 0) {
      stationHakataInfos = await Promise.all(
        topStations.map(s =>
          fetchTransitToHakata(s.candidate.place_lat, s.candidate.place_lng, apiKey)
        )
      );
      console.log(
        `[transitAccess] Hakata transit info for ${sellerNumber}:`,
        stationHakataInfos.map(h => h.routeText)
      );
    }

    const buildRow = (
      transportType: TransportType,
      rank: number,
      item: WithDistance,
      hakataInfo?: HakataInfo
    ): any => {
      const existing = existingMap.get(`${transportType}_${rank}`);
      return {
        seller_number: sellerNumber,
        store_type: storeType,
        transport_type: transportType,
        rank,
        name: item.candidate.name,
        // 路線名: transit APIで取得（手動修正がある場合はそちらを優先するため既存値を確認）
        line_name: existing?.is_manually_corrected && existing?.manual_line_name
          ? existing.manual_line_name
          : (hakataInfo?.lineName ?? null),
        walk_distance_m: item.meters,
        walk_minutes: calcWalkMinutes(item.meters),
        is_estimated_distance: item.isEstimated,
        place_id: item.candidate.place_id,
        place_lat: item.candidate.place_lat,
        place_lng: item.candidate.place_lng,
        // 博多駅への交通情報（駅のみ）
        transit_to_hakata_minutes: hakataInfo?.minutesToHakata ?? null,
        transit_to_hakata_text:    hakataInfo?.routeText ?? null,
        // ユーザー操作値は既存データを引き継ぐ（なければデフォルト）
        is_selected:            existing?.is_selected            ?? false,
        is_manually_corrected:  existing?.is_manually_corrected  ?? false,
        manual_name:            existing?.manual_name            ?? null,
        manual_line_name:       existing?.manual_line_name       ?? null,
        manual_walk_minutes:    existing?.manual_walk_minutes    ?? null,
        is_confirmed:           existing?.is_confirmed           ?? false,
        confirmed_at:           existing?.confirmed_at           ?? null,
        // メタデータ
        data_source: 'Google Maps Places API',
        fetched_at: now,
        fetch_error: null,
        updated_at: now,
      };
    };

    for (let i = 0; i < topStations.length; i++) {
      upsertRows.push(buildRow('station', i + 1, topStations[i], stationHakataInfos[i]));
    }
    for (let i = 0; i < topBusStops.length; i++) {
      upsertRows.push(buildRow('bus_stop', i + 1, topBusStops[i]));
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('seller_transit_access')
        .upsert(upsertRows, { onConflict: 'seller_number,transport_type,rank' });

      if (upsertError) {
        console.error('[transitAccess/fetch] upsert error:', upsertError);
        return res.status(500).json({ error: '交通アクセス情報の保存に失敗しました' });
      }
    }

    // 保存済みデータを返す
    const { data: saved } = await supabase
      .from('seller_transit_access')
      .select('*')
      .eq('seller_number', sellerNumber)
      .order('transport_type', { ascending: true })
      .order('rank', { ascending: true });

    console.log(
      `[transitAccess] saved ${upsertRows.length} records for ${sellerNumber}` +
      ` (station=${topStations.length} bus_stop=${topBusStops.length})`
    );
    return res.json({
      success: true,
      data: saved ?? [],
      storeType,
      counts: { station: topStations.length, bus_stop: topBusStops.length },
    });

  } catch (err: any) {
    console.error('[transitAccess/fetch] error:', err?.message);
    return res.status(500).json({ error: `取得に失敗しました: ${err?.message}` });
  }
});

// ──────────────────────────────────────────────
// PATCH /api/transit-access/seller/:sellerNumber/:id
// 選択状態・手動修正・確認状況を更新する（取得値は変更しない）
// ──────────────────────────────────────────────

router.patch('/seller/:sellerNumber/:id', async (req: Request, res: Response) => {
  const { sellerNumber, id } = req.params;
  const {
    is_selected,
    is_manually_corrected,
    manual_name,
    manual_line_name,
    manual_walk_minutes,
    is_confirmed,
  } = req.body;

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (is_selected !== undefined)           updates.is_selected = is_selected;
    if (is_manually_corrected !== undefined) updates.is_manually_corrected = is_manually_corrected;
    if (manual_name !== undefined)           updates.manual_name = manual_name || null;
    if (manual_line_name !== undefined)      updates.manual_line_name = manual_line_name || null;
    if (manual_walk_minutes !== undefined)   updates.manual_walk_minutes = manual_walk_minutes ?? null;
    if (is_confirmed !== undefined) {
      updates.is_confirmed = is_confirmed;
      updates.confirmed_at = is_confirmed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('seller_transit_access')
      .update(updates)
      .eq('id', id)
      .eq('seller_number', sellerNumber)  // seller_number でも絞り込み（セキュリティ）
      .select()
      .single();

    if (error) {
      console.error('[transitAccess/PATCH] supabase error:', error);
      return res.status(500).json({ error: '更新に失敗しました' });
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[transitAccess/PATCH] error:', err?.message);
    return res.status(500).json({ error: '更新に失敗しました' });
  }
});

export default router;
