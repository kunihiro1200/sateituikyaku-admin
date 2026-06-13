// 評価ポイントAPI（売主ごとの物件おすすめポイント・注意点）
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface EvaluationPointsData {
  point_1?: string | null;
  point_2?: string | null;
  point_3?: string | null;
  point_4?: string | null;
  point_5?: string | null;
  point_6?: string | null;
  point_7?: string | null;
  point_8?: string | null;
  point_9?: string | null;
  point_10?: string | null;
  caution_1?: string | null;
  caution_2?: string | null;
  caution_3?: string | null;
  caution_4?: string | null;
}

// 売主の評価ポイントを取得
router.get('/sellers/:sellerId/evaluation-points', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;

    const { data, error } = await supabase
      .from('seller_evaluation_points')
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
        point_1: null,
        point_2: null,
        point_3: null,
        point_4: null,
        point_5: null,
        point_6: null,
        point_7: null,
        point_8: null,
        point_9: null,
        point_10: null,
        caution_1: null,
        caution_2: null,
        caution_3: null,
        caution_4: null,
      });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching evaluation points:', error);
    res.status(500).json({ error: error.message });
  }
});

// 売主の評価ポイントを保存（upsert）
router.put('/sellers/:sellerId/evaluation-points', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const body: EvaluationPointsData & { updated_by?: string } = req.body;

    const upsertData = {
      seller_id: sellerId,
      point_1: body.point_1 || null,
      point_2: body.point_2 || null,
      point_3: body.point_3 || null,
      point_4: body.point_4 || null,
      point_5: body.point_5 || null,
      point_6: body.point_6 || null,
      point_7: body.point_7 || null,
      point_8: body.point_8 || null,
      point_9: body.point_9 || null,
      point_10: body.point_10 || null,
      caution_1: body.caution_1 || null,
      caution_2: body.caution_2 || null,
      caution_3: body.caution_3 || null,
      caution_4: body.caution_4 || null,
      updated_at: new Date().toISOString(),
      updated_by: body.updated_by || null,
    };

    const { data, error } = await supabase
      .from('seller_evaluation_points')
      .upsert(upsertData, { onConflict: 'seller_id' })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error saving evaluation points:', error);
    res.status(500).json({ error: error.message });
  }
});

// 物件番号（seller_number）から評価ポイントを取得（買主ページ用）
router.get('/evaluation-points/by-seller-number/:sellerNumber', async (req: Request, res: Response) => {
  try {
    const { sellerNumber } = req.params;

    // seller_numberからseller_idを取得
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('id')
      .eq('seller_number', sellerNumber)
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({ error: '売主が見つかりません' });
    }

    const { data, error } = await supabase
      .from('seller_evaluation_points')
      .select('*')
      .eq('seller_id', seller.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json(null);
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching evaluation points by seller number:', error);
    res.status(500).json({ error: error.message });
  }
});

// 複数の物件番号から評価ポイントをバッチ取得（買主リスト一覧用）
router.post('/evaluation-points/batch', async (req: Request, res: Response) => {
  try {
    const { sellerNumbers } = req.body;

    if (!sellerNumbers || !Array.isArray(sellerNumbers) || sellerNumbers.length === 0) {
      return res.json({});
    }

    // seller_numbersから該当するsellersを取得
    const { data: sellers, error: sellersError } = await supabase
      .from('sellers')
      .select('id, seller_number')
      .in('seller_number', sellerNumbers);

    if (sellersError) throw sellersError;
    if (!sellers || sellers.length === 0) return res.json({});

    const sellerIds = sellers.map(s => s.id);
    const sellerIdToNumber = new Map(sellers.map(s => [s.id, s.seller_number]));

    // 評価ポイントを取得
    const { data: points, error: pointsError } = await supabase
      .from('seller_evaluation_points')
      .select('*')
      .in('seller_id', sellerIds);

    if (pointsError) throw pointsError;

    // seller_number をキーにしたマップを返す
    const result: Record<string, any> = {};
    if (points) {
      for (const point of points) {
        const sellerNumber = sellerIdToNumber.get(point.seller_id);
        if (sellerNumber) {
          result[sellerNumber] = point;
        }
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching batch evaluation points:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
