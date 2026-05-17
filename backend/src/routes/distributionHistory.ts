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

    // 住所＋金額で重複チェック
    if (price) {
      const { data: priceMatch, error: priceError } = await supabase
        .from('distribution_history')
        .select('*')
        .eq('property_address', propertyAddress)
        .eq('price', price)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (!priceError && priceMatch && priceMatch.length > 0) {
        return res.json({ isDuplicate: true, history: priceMatch[0] });
      }
    }

    // 住所＋土地面積で重複チェック
    if (landArea) {
      const { data: areaMatch, error: areaError } = await supabase
        .from('distribution_history')
        .select('*')
        .eq('property_address', propertyAddress)
        .eq('land_area', landArea)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (!areaError && areaMatch && areaMatch.length > 0) {
        return res.json({ isDuplicate: true, history: areaMatch[0] });
      }
    }

    res.json({ isDuplicate: false, history: null });
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

/**
 * 既存の配信履歴にland_areaを一括補完（source_urlからスクレイピングして取得）
 * POST /api/distribution-history/backfill-land-area
 */
router.post('/backfill-land-area', async (req: Request, res: Response) => {
  try {
    // land_areaがnullでsource_urlがある履歴を取得
    const { data: records, error } = await supabase
      .from('distribution_history')
      .select('id, source_url')
      .is('land_area', null)
      .not('source_url', 'is', null);

    if (error) throw error;
    if (!records || records.length === 0) {
      return res.json({ message: 'No records to update', updated: 0 });
    }

    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';
    let updated = 0;

    for (const record of records) {
      try {
        // スクレイピングサーバーにリクエスト（プレビューのみ、DB保存なし）
        const scrapeRes = await fetch(`${scrapeApiUrl}/scrape-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: record.source_url }),
        });

        if (!scrapeRes.ok) continue;

        const result = await scrapeRes.json() as any;
        const landArea = result?.data?.details?.['土地面積'] || result?.data?.area || null;

        if (landArea) {
          await supabase
            .from('distribution_history')
            .update({ land_area: landArea })
            .eq('id', record.id);
          updated++;
        }

        // レート制限対策（2秒待機）
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (scrapeErr) {
        console.error(`[backfill] Failed for id=${record.id}:`, scrapeErr);
      }
    }

    res.json({ message: `Updated ${updated}/${records.length} records`, updated, total: records.length });
  } catch (err: any) {
    console.error('[distribution-history] backfill error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
