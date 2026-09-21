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
