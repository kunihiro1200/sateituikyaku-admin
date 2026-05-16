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
 * 重複チェック（物件住所＋金額の完全一致）
 * POST /api/distribution-history/check-duplicate
 * Body: { propertyAddress: string, price: string }
 */
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { propertyAddress, price } = req.body;

    if (!propertyAddress || !price) {
      return res.json({ isDuplicate: false, history: null });
    }

    const { data, error } = await supabase
      .from('distribution_history')
      .select('*')
      .eq('property_address', propertyAddress)
      .eq('price', price)
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
 * Body: { propertyAddress: string, price: string, propertyType?: string, sourceUrl?: string, sentCount: number }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { propertyAddress, price, propertyType, sourceUrl, sentCount } = req.body;

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
