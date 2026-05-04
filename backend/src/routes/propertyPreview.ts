import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

// GET /api/property-preview/:slug - 公開プレビュー取得（認証不要）
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('property_previews')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: '物件情報が見つかりません' });
    }

    // 期限切れチェック
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.status(410).json({ error: 'この物件情報は期限切れです' });
    }

    res.json(data);
  } catch (err: any) {
    console.error('[propertyPreview] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
