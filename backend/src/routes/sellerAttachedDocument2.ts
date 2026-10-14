// 訪問準備「添付資料２」API（売主ごとの小学校・中学校・最寄り駅等の入力項目）
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface AttachedDocument2Data {
  // 小学校（名称・徒歩分）
  elementary_school_name?: string | null;
  elementary_school_walk?: string | null;
  // 中学校（名称・徒歩分）
  junior_high_school_name?: string | null;
  junior_high_school_walk?: string | null;
  // 最寄り駅（名称・徒歩分）
  nearest_station_name?: string | null;
  nearest_station_walk?: string | null;
  // 最寄りバス停（名称・徒歩分）
  nearest_bus_stop_name?: string | null;
  nearest_bus_stop_walk?: string | null;
  // マンション用チェックボックス
  currently_listed_same_building_checked?: boolean;
  same_building_sold_case_checked?: boolean;
  nearby_mansion_sold_case_checked?: boolean;
  // マンション用テキスト
  management_fee?: string | null;
  repair_reserve_fund?: string | null;
  // マンション以外用チェックボックス
  current_nearby_listing_checked?: boolean;
  past_sold_case_checked?: boolean;
  // マンション以外用テキスト
  boundary_stake?: string | null;
  road_width?: string | null;
  road_contact?: string | null;
  // 共通
  property_tax?: string | null;
  parking?: string | null;
  pet?: string | null;
  // 現地調査チェックリスト memo
  site_check_memo1?: string | null;
  site_check_memo2?: string | null;
  site_check_memo3?: string | null;
  site_check_memo4?: string | null;
  // ハザードマップ・道路の種類（旧:抵当権）
  hazard_map?: string | null;
  hazard_map_confirmed?: boolean;
  mortgage_info?: string | null;
  // 新規フィールド
  road_type?: string | null;
  sale_reason?: string | null;
  boundary_info?: string | null;
  gas_propane?: boolean;
  gas_city_gas?: boolean;
  drainage_public?: boolean;
  drainage_septic?: boolean;
  drainage_cesspool?: boolean;
  construction_company?: string | null;
  management_company?: string | null;
  // 訪問時記入フィールド
  exterior_reform?: string | null;
  interior_reform?: string | null;
  defects?: string | null;
  solar_panel?: string | null;
  incident_info?: string | null;
  minpaku?: string | null;
  // マンション建物情報（外部建物情報から自動補完）
  mansion_building_name?: string | null;
  mansion_built_year_month?: string | null;
  mansion_floors_above?: number | null;
  mansion_floors_below?: number | null;
  mansion_total_units?: number | null;
  mansion_structure?: string | null;
  mansion_developer?: string | null;
  mansion_management_type?: string | null;
  mansion_has_elevator?: string | null;
  // 学校距離・正門座標（Google Maps Directions API取得）
  elementary_school_distance?: number | null;
  elementary_school_entrance_lat?: number | null;
  elementary_school_entrance_lng?: number | null;
  junior_high_school_distance?: number | null;
  junior_high_school_entrance_lat?: number | null;
  junior_high_school_entrance_lng?: number | null;
  school_info_fetched_at?: string | null;
  // 学校確認チェックボックス
  elementary_school_confirmed?: boolean;
  junior_high_school_confirmed?: boolean;
  // 交通アクセス確認チェックボックス
  nearest_station_confirmed?: boolean;
  nearest_bus_stop_confirmed?: boolean;
  // 【特典】チェックボックス
  tokuten_cleaning?: boolean;
  tokuten_garden?: boolean;
  tokuten_wallpaper?: boolean;
  tokuten_removal?: boolean;
  tokuten_warranty?: boolean;
  tokuten_fee_discount?: boolean;
  tokuten_bridge_loan?: boolean;
  tokuten_key_exchange?: boolean;
}

const EMPTY_RESPONSE = (sellerId: string) => ({
  seller_id: sellerId,
  elementary_school_name: null,
  elementary_school_walk: null,
  junior_high_school_name: null,
  junior_high_school_walk: null,
  nearest_station_name: null,
  nearest_station_walk: null,
  nearest_bus_stop_name: null,
  nearest_bus_stop_walk: null,
  currently_listed_same_building_checked: false,
  same_building_sold_case_checked: false,
  nearby_mansion_sold_case_checked: false,
  management_fee: null,
  repair_reserve_fund: null,
  current_nearby_listing_checked: false,
  past_sold_case_checked: false,
  boundary_stake: null,
  road_width: null,
  road_contact: null,
  property_tax: null,
  parking: null,
  pet: null,
  site_check_memo1: null,
  site_check_memo2: null,
  site_check_memo3: null,
  site_check_memo4: null,
  hazard_map: null,
  hazard_map_confirmed: false,
  mortgage_info: null,
  road_type: null,
  sale_reason: null,
  boundary_info: null,
  gas_propane: false,
  gas_city_gas: false,
  drainage_public: false,
  drainage_septic: false,
  drainage_cesspool: false,
  construction_company: null,
  management_company: null,
  exterior_reform: null,
  interior_reform: null,
  defects: null,
  solar_panel: null,
  incident_info: null,
  minpaku: null,
  tokuten_cleaning: false,
  tokuten_garden: false,
  tokuten_wallpaper: false,
  tokuten_removal: false,
  tokuten_warranty: false,
  tokuten_fee_discount: false,
  tokuten_bridge_loan: false,
  tokuten_key_exchange: false,
});

// 売主の添付資料２入力項目を取得
router.get('/sellers/:sellerId/attached-document2', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;

    const { data, error } = await supabase
      .from('seller_attached_document2')
      .select('*')
      .eq('seller_id', sellerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json(EMPTY_RESPONSE(sellerId));
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching attached-document2:', error);
    res.status(500).json({ error: error.message });
  }
});

// 売主の添付資料２入力項目を保存（upsert）
router.put('/sellers/:sellerId/attached-document2', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const body: AttachedDocument2Data & { updated_by?: string } = req.body;

    const upsertData = {
      seller_id: sellerId,
      elementary_school_name: body.elementary_school_name || null,
      elementary_school_walk: body.elementary_school_walk || null,
      junior_high_school_name: body.junior_high_school_name || null,
      junior_high_school_walk: body.junior_high_school_walk || null,
      nearest_station_name: body.nearest_station_name || null,
      nearest_station_walk: body.nearest_station_walk || null,
      nearest_bus_stop_name: body.nearest_bus_stop_name || null,
      nearest_bus_stop_walk: body.nearest_bus_stop_walk || null,
      currently_listed_same_building_checked: !!body.currently_listed_same_building_checked,
      same_building_sold_case_checked: !!body.same_building_sold_case_checked,
      nearby_mansion_sold_case_checked: !!body.nearby_mansion_sold_case_checked,
      management_fee: body.management_fee || null,
      repair_reserve_fund: body.repair_reserve_fund || null,
      current_nearby_listing_checked: !!body.current_nearby_listing_checked,
      past_sold_case_checked: !!body.past_sold_case_checked,
      boundary_stake: body.boundary_stake || null,
      road_width: body.road_width || null,
      road_contact: body.road_contact || null,
      property_tax: body.property_tax || null,
      parking: body.parking || null,
      pet: body.pet || null,
      site_check_memo1: body.site_check_memo1 || null,
      site_check_memo2: body.site_check_memo2 || null,
      site_check_memo3: body.site_check_memo3 || null,
      site_check_memo4: body.site_check_memo4 || null,
      hazard_map: body.hazard_map || null,
      hazard_map_confirmed: !!body.hazard_map_confirmed,
      mortgage_info: body.mortgage_info || null,
      road_type: body.road_type || null,
      sale_reason: body.sale_reason || null,
      boundary_info: body.boundary_info || null,
      gas_propane: !!body.gas_propane,
      gas_city_gas: !!body.gas_city_gas,
      drainage_public: !!body.drainage_public,
      drainage_septic: !!body.drainage_septic,
      drainage_cesspool: !!body.drainage_cesspool,
      construction_company: body.construction_company || null,
      management_company: body.management_company || null,
      exterior_reform: body.exterior_reform || null,
      interior_reform: body.interior_reform || null,
      defects: body.defects || null,
      solar_panel: body.solar_panel || null,
      incident_info: body.incident_info || null,
      minpaku: body.minpaku || null,
      // マンション建物情報
      mansion_building_name:    body.mansion_building_name    || null,
      mansion_built_year_month: body.mansion_built_year_month || null,
      mansion_floors_above:     body.mansion_floors_above     != null ? Number(body.mansion_floors_above)     : null,
      mansion_floors_below:     body.mansion_floors_below     != null ? Number(body.mansion_floors_below)     : null,
      mansion_total_units:      body.mansion_total_units      != null ? Number(body.mansion_total_units)      : null,
      mansion_structure:        body.mansion_structure        || null,
      mansion_developer:        body.mansion_developer        || null,
      mansion_management_type:  body.mansion_management_type  || null,
      mansion_has_elevator:     body.mansion_has_elevator     || null,
      tokuten_cleaning: !!body.tokuten_cleaning,
      tokuten_garden: !!body.tokuten_garden,
      tokuten_wallpaper: !!body.tokuten_wallpaper,
      tokuten_removal: !!body.tokuten_removal,
      tokuten_warranty: !!body.tokuten_warranty,
      tokuten_fee_discount: !!body.tokuten_fee_discount,
      tokuten_bridge_loan: !!body.tokuten_bridge_loan,
      tokuten_key_exchange: !!body.tokuten_key_exchange,
      // 注意: 以下の確認フラグはPATCHエンドポイント専用で更新する
      // PUT(全体upsert)には含めない → DBにカラムが存在しなくてもPUTが失敗しない
      updated_at: new Date().toISOString(),
      updated_by: body.updated_by || null,
    };

    const { data, error } = await supabase
      .from('seller_attached_document2')
      .upsert(upsertData, { onConflict: 'seller_id' })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error saving attached-document2:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// ──────────────────────────────────────────────────────────────────────────────
// 特典チェックボックスのみを部分更新（他のフィールドを上書きしない）
// PATCH /sellers/:sellerId/attached-document2/tokuten
// ──────────────────────────────────────────────────────────────────────────────
const TOKUTEN_KEYS = [
  'tokuten_cleaning',
  'tokuten_garden',
  'tokuten_wallpaper',
  'tokuten_removal',
  'tokuten_warranty',
  'tokuten_fee_discount',
  'tokuten_bridge_loan',
  'tokuten_key_exchange',
] as const;

router.patch('/sellers/:sellerId/attached-document2/tokuten', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const body = req.body as Record<string, unknown>;

    // bodyに含まれるtokuten_*フィールドのみ更新
    const patch: Record<string, boolean | string> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of TOKUTEN_KEYS) {
      if (key in body) patch[key] = !!body[key];
    }

    // 行が存在するか確認
    const { data: existing } = await supabase
      .from('seller_attached_document2')
      .select('seller_id')
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (existing) {
      // 既存行 → 該当フィールドのみ UPDATE
      const { error } = await supabase
        .from('seller_attached_document2')
        .update(patch)
        .eq('seller_id', sellerId);
      if (error) throw error;
    } else {
      // 行なし → デフォルト値付きで INSERT
      const defaults: Record<string, boolean | string | null> = {
        seller_id: sellerId,
        updated_at: new Date().toISOString(),
      };
      for (const key of TOKUTEN_KEYS) {
        defaults[key] = key in body ? !!body[key] : false;
      }
      const { error } = await supabase
        .from('seller_attached_document2')
        .insert(defaults);
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error patching tokuten:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 学校情報のみを部分更新（他のフィールドを上書きしない）
// PATCH /sellers/:sellerId/attached-document2/school
// ──────────────────────────────────────────────────────────────────────────────
router.patch('/sellers/:sellerId/attached-document2/school', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const body = req.body as Record<string, unknown>;

    // 必ず存在するコアカラム（当初から存在）
    const coreFields = [
      'elementary_school_name',
      'elementary_school_walk',
      'junior_high_school_name',
      'junior_high_school_walk',
    ] as const;

    // マイグレーション追加カラム（未実行の場合はSupabaseがエラーを返すため個別にtry）
    const extendedFields = [
      'elementary_school_distance',
      'elementary_school_entrance_lat',
      'elementary_school_entrance_lng',
      'elementary_school_confirmed',
      'junior_high_school_distance',
      'junior_high_school_entrance_lat',
      'junior_high_school_entrance_lng',
      'junior_high_school_confirmed',
      'school_info_fetched_at',
    ] as const;

    // コアカラムのパッチデータを構築
    const corePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of coreFields) {
      if (key in body) corePatch[key] = body[key] ?? null;
    }

    // 拡張カラムのパッチデータを構築（値が明示的に指定されたもののみ）
    const extPatch: Record<string, unknown> = {};
    for (const key of extendedFields) {
      if (key in body && body[key] !== undefined) extPatch[key] = body[key] ?? null;
    }

    // 行が存在するか確認
    const { data: existing } = await supabase
      .from('seller_attached_document2')
      .select('seller_id')
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('seller_attached_document2')
        .update({ ...corePatch, ...extPatch })
        .eq('seller_id', sellerId);
      if (error) {
        // 拡張カラムが原因の場合はコアのみで再試行
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.warn('[school PATCH] 拡張カラムなしで再試行:', error.message);
          const { error: coreErr } = await supabase
            .from('seller_attached_document2')
            .update(corePatch)
            .eq('seller_id', sellerId);
          if (coreErr) throw coreErr;
        } else {
          throw error;
        }
      }
    } else {
      const { error } = await supabase
        .from('seller_attached_document2')
        .insert({ seller_id: sellerId, ...corePatch, ...extPatch });
      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.warn('[school PATCH] 拡張カラムなしで再試行:', error.message);
          const { error: coreErr } = await supabase
            .from('seller_attached_document2')
            .insert({ seller_id: sellerId, ...corePatch });
          if (coreErr) throw coreErr;
        } else {
          throw error;
        }
      }
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error patching school info:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 交通アクセス情報のみを部分更新（他のフィールドを上書きしない）
// PATCH /sellers/:sellerId/attached-document2/transit
// ──────────────────────────────────────────────────────────────────────────────
router.patch('/sellers/:sellerId/attached-document2/transit', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const body = req.body as {
      nearest_station_name?: string | null;
      nearest_station_walk?: string | null;
      nearest_station_confirmed?: boolean;
      nearest_bus_stop_name?: string | null;
      nearest_bus_stop_walk?: string | null;
      nearest_bus_stop_confirmed?: boolean;
    };

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const transitFields = [
      'nearest_station_name',
      'nearest_station_walk',
      'nearest_station_confirmed',
      'nearest_bus_stop_name',
      'nearest_bus_stop_walk',
      'nearest_bus_stop_confirmed',
    ] as const;

    for (const key of transitFields) {
      if (key in body) patch[key] = body[key] ?? null;
    }

    // 行が存在するか確認
    const { data: existing } = await supabase
      .from('seller_attached_document2')
      .select('seller_id')
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('seller_attached_document2')
        .update(patch)
        .eq('seller_id', sellerId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('seller_attached_document2')
        .insert({ seller_id: sellerId, ...patch });
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error patching transit info:', error);
    res.status(500).json({ error: error.message });
  }
});
