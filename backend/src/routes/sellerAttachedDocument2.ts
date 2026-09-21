// 訪問準備「添付資料２」API（売主ごとの小学校・中学校・最寄り駅等の入力項目）
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface AttachedDocument2Data {
  elementary_school?: string | null;
  junior_high_school?: string | null;
  nearest_station?: string | null;
  nearest_bus_stop?: string | null;
  currently_listed_same_building?: string | null;
  other_nearby_cases?: string | null;
  comparison_list?: string | null;
}

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
      // PGRST116 = no rows returned (まだ作成されていない場合)
      throw error;
    }

    // まだ存在しない場合は空のデータを返す
    if (!data) {
      return res.json({
        seller_id: sellerId,
        elementary_school: null,
        junior_high_school: null,
        nearest_station: null,
        nearest_bus_stop: null,
        currently_listed_same_building: null,
        other_nearby_cases: null,
        comparison_list: null,
      });
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
      elementary_school: body.elementary_school || null,
      junior_high_school: body.junior_high_school || null,
      nearest_station: body.nearest_station || null,
      nearest_bus_stop: body.nearest_bus_stop || null,
      currently_listed_same_building: body.currently_listed_same_building || null,
      other_nearby_cases: body.other_nearby_cases || null,
      comparison_list: body.comparison_list || null,
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
