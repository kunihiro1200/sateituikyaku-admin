import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/auth';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.use(authenticate);

/**
 * 配信履歴を取得（最新50件）
 * GET /api/distribution-history
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('distribution_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    console.error('[distribution-history] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 重複チェック（住所＋土地面積の一致、土地面積がない場合は住所＋金額）
 * POST /api/distribution-history/check-duplicate
 * Body: { propertyAddress: string, price: string, landArea?: string }
 */
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { propertyAddress, price, landArea } = req.body;

    if (!propertyAddress) {
      return res.json({ isDuplicate: false, history: null });
    }

    let query = supabase
      .from('distribution_history')
      .select('*')
      .eq('property_address', propertyAddress);

    // 土地面積がある場合は土地面積で重複チェック（価格は変わる可能性があるため）
    if (landArea) {
      query = query.eq('land_area', landArea);
    } else if (price) {
      // 土地面積がない場合は従来通り金額でチェック
      query = query.eq('price', price);
    } else {
      return res.json({ isDuplicate: false, history: null });
    }

    const { data, error } = await query
      .order('sent_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      res.json({ isDuplicate: true, history: data[0] });
    } else {
      res.json({ isDuplicate: false, history: null });
    }
  } catch (err: any) {
    console.error('[distribution-history] check-duplicate error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 配信履歴を記録
 * POST /api/distribution-history
 * Body: { propertyAddress: string, price: string, propertyType?: string, sourceUrl?: string, landArea?: string, sentCount: number }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { propertyAddress, price, propertyType, sourceUrl, landArea, sentCount } = req.body;

    if (!propertyAddress || !price) {
      return res.status(400).json({ error: 'propertyAddress and price are required' });
    }

    const { data, error } = await supabase
      .from('distribution_history')
      .insert({
        property_address: propertyAddress,
        price: price,
        property_type: propertyType || null,
        source_url: sourceUrl || null,
        land_area: landArea || null,
        sent_count: sentCount || 1,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error('[distribution-history] POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
