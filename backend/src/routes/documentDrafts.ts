/**
 * 資料生成ドラフト保存・取得API
 * POST /api/document-drafts/:sellerNumber/:documentType  - 保存（upsert）
 * GET  /api/document-drafts/:sellerNumber/:documentType  - 取得
 */
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// GET /api/document-drafts/:sellerNumber/:documentType
router.get('/:sellerNumber/:documentType', async (req: Request, res: Response) => {
  try {
    const { sellerNumber, documentType } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('document_drafts')
      .select('data, saved_at')
      .eq('seller_number', sellerNumber.toUpperCase())
      .eq('document_type', documentType)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.json({ data: data.data, savedAt: data.saved_at });
  } catch (err) {
    console.error('[documentDrafts] GET error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/document-drafts/:sellerNumber/:documentType
router.post('/:sellerNumber/:documentType', async (req: Request, res: Response) => {
  try {
    const { sellerNumber, documentType } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ message: 'data is required' });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('document_drafts')
      .upsert(
        {
          seller_number: sellerNumber.toUpperCase(),
          document_type: documentType,
          data,
          saved_at: new Date().toISOString(),
        },
        { onConflict: 'seller_number,document_type' }
      );

    if (error) {
      console.error('[documentDrafts] upsert error:', error);
      return res.status(500).json({ message: 'Failed to save' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[documentDrafts] POST error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
