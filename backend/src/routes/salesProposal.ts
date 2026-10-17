/**
 * 販売提案書 API
 *
 * エンドポイント：
 *   GET  /api/sales-proposals            — 一覧取得（?sellerId= または ?sellerNumber= でフィルタ）
 *   POST /api/sales-proposals            — 新規保存
 *   PUT  /api/sales-proposals/:id        — 更新
 *   DELETE /api/sales-proposals/:id      — 削除
 *
 * 必要なテーブル（初回のみ Supabase SQL エディタで実行）：
 *   → add-sales-proposals-table.sql を参照
 */
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/auth';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

// ─── GET /api/sales-proposals ─────────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId, sellerNumber } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('sales_proposals')
      .select('id, seller_number, market_price, challenge_price, proposed_listing_price, target_buyers, other_instructions, created_by, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (sellerId) query = query.eq('seller_id', String(sellerId));
    if (sellerNumber) query = query.eq('seller_number', String(sellerNumber));

    const { data, error } = await query;
    if (error) throw error;

    res.json(data ?? []);
  } catch (error: any) {
    console.error('[salesProposal/GET] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/sales-proposals ────────────────────────────────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const body = req.body;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('sales_proposals')
      .insert({
        seller_id: body.seller_id || null,
        seller_number: body.seller_number,
        market_price: body.market_price || null,
        challenge_price: body.challenge_price || null,
        proposed_listing_price: body.proposed_listing_price || null,
        target_buyers: body.target_buyers || null,
        other_instructions: body.other_instructions || null,
        school_info: body.school_info || null,
        transit_info: body.transit_info || null,
        generated_prompt: body.generated_prompt || null,
        created_by: body.created_by || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('[salesProposal/POST] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── PUT /api/sales-proposals/:id ─────────────────────────────────────────────
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();
    const body = req.body;

    const { data, error } = await supabase
      .from('sales_proposals')
      .update({
        market_price: body.market_price || null,
        challenge_price: body.challenge_price || null,
        proposed_listing_price: body.proposed_listing_price || null,
        target_buyers: body.target_buyers || null,
        other_instructions: body.other_instructions || null,
        school_info: body.school_info || null,
        transit_info: body.transit_info || null,
        generated_prompt: body.generated_prompt || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('[salesProposal/PUT] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE /api/sales-proposals/:id ──────────────────────────────────────────
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    const { error } = await supabase
      .from('sales_proposals')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[salesProposal/DELETE] error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
