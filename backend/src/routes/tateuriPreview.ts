import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

// GET /api/tateuri - 建売物件一覧取得（公開・認証不要）
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('property_previews')
      .select('slug, title, price, address, access, layout, area, images, lat, lng, created_at')
      .eq('is_tateuri', true)
      .eq('is_active', true)
      .order('address', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    console.error('[tateuri] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tateuri/delete - URLで物件を削除（認証不要・URLが秘密鍵代わり）
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { source_url } = req.body;
    if (!source_url) {
      return res.status(400).json({ error: 'source_url is required' });
    }

    const supabase = getSupabase();

    // URLを正規化（クエリパラメータを除去して比較）
    const normalizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, '') + '/';
      } catch {
        return url;
      }
    };

    const normalized = normalizeUrl(source_url);

    // source_urlが一致するものを非アクティブ化（論理削除）
    const { data, error } = await supabase
      .from('property_previews')
      .update({ is_active: false })
      .eq('is_tateuri', true)
      .like('source_url', `${normalized}%`)
      .select('slug, title');

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: '該当する物件が見つかりません' });
    }

    res.json({ success: true, deleted: data });
  } catch (err: any) {
    console.error('[tateuri] DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
