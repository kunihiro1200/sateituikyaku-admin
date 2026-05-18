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
 * + property_previewsテーブルも横断チェック（建売HP登録済みの物件）
 * POST /api/distribution-history/check-duplicate
 * Body: { propertyAddress: string, price: string, landArea?: string, sourceUrl?: string }
 */
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { propertyAddress, price, landArea, sourceUrl } = req.body;

    if (!propertyAddress) {
      return res.json({ isDuplicate: false, history: null });
    }

    // チェック1: distribution_history内で住所＋金額の重複チェック
    if (price) {
      const { data: priceMatch, error: priceError } = await supabase
        .from('distribution_history')
        .select('*')
        .eq('property_address', propertyAddress)
        .eq('price', price)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (!priceError && priceMatch && priceMatch.length > 0) {
        return res.json({ isDuplicate: true, history: priceMatch[0], source: '配信履歴（住所＋金額一致）' });
      }
    }

    // チェック2: distribution_history内で住所＋土地面積の重複チェック
    if (landArea) {
      const { data: areaMatch, error: areaError } = await supabase
        .from('distribution_history')
        .select('*')
        .eq('property_address', propertyAddress)
        .eq('land_area', landArea)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (!areaError && areaMatch && areaMatch.length > 0) {
        return res.json({ isDuplicate: true, history: areaMatch[0], source: '配信履歴（住所＋土地面積一致）' });
      }
    }

    // チェック3: property_previewsテーブルを横断チェック（建売HP登録済みの物件）
    // URLで確認
    if (sourceUrl) {
      const normalizeUrl = (url: string) => {
        try {
          const u = new URL(url);
          return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, '') + '/';
        } catch {
          return url;
        }
      };
      const normalized = normalizeUrl(sourceUrl);

      const { data: urlMatch, error: urlError } = await supabase
        .from('property_previews')
        .select('slug, title, address, created_at, is_tateuri')
        .like('source_url', `${normalized}%`)
        .eq('is_active', true)
        .limit(1);

      if (!urlError && urlMatch && urlMatch.length > 0) {
        const existing = urlMatch[0];
        const source = existing.is_tateuri ? '建売専門HP' : '他社物件配信';
        return res.json({
          isDuplicate: true,
          history: {
            property_address: existing.address,
            source_url: sourceUrl,
            sent_at: existing.created_at,
          },
          source: `${source}に登録済み（URL一致）`,
        });
      }
    }

    // チェック4: property_previewsテーブルを住所で横断チェック
    {
      const { data: addressMatch, error: addressError } = await supabase
        .from('property_previews')
        .select('slug, title, address, created_at, is_tateuri')
        .eq('address', propertyAddress)
        .eq('is_active', true)
        .limit(1);

      if (!addressError && addressMatch && addressMatch.length > 0) {
        const existing = addressMatch[0];
        const source = existing.is_tateuri ? '建売専門HP' : '他社物件配信';
        return res.json({
          isDuplicate: true,
          history: {
            property_address: existing.address,
            source_url: null,
            sent_at: existing.created_at,
          },
          source: `${source}に登録済み（住所一致）`,
        });
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
