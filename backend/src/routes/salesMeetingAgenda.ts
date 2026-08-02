import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );
}

/**
 * GET /api/sales-meeting-agenda - 議題一覧取得
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sales_meeting_agenda_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (error: any) {
    console.error('Failed to fetch sales meeting agenda items:', error);
    res.status(500).json({
      error: '議題の取得に失敗しました',
      details: error.message,
    });
  }
});

/**
 * POST /api/sales-meeting-agenda - 議題新規作成
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { title, content, assignee, due_date, created_by } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'タイトルを入力してください' });
    }

    const { data, error } = await supabase
      .from('sales_meeting_agenda_items')
      .insert({
        title: title.trim(),
        content: content ?? null,
        assignee: assignee ?? null,
        due_date: due_date || null,
        created_by: created_by ?? null,
        completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to create sales meeting agenda item:', error);
    res.status(500).json({
      error: '議題の作成に失敗しました',
      details: error.message,
    });
  }
});

/**
 * GET /api/sales-meeting-agenda/:id - 議題詳細取得
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sales_meeting_agenda_items')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: '議題が見つかりません' });

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to fetch sales meeting agenda item:', error);
    res.status(500).json({
      error: '議題の取得に失敗しました',
      details: error.message,
    });
  }
});

/**
 * PUT /api/sales-meeting-agenda/:id - 議題更新
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { title, content, assignee, due_date } = req.body;

    const fields: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) fields.title = title;
    if (content !== undefined) fields.content = content;
    if (assignee !== undefined) fields.assignee = assignee;
    if (due_date !== undefined) fields.due_date = due_date || null;

    const { data, error } = await supabase
      .from('sales_meeting_agenda_items')
      .update(fields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to update sales meeting agenda item:', error);
    res.status(500).json({
      error: '議題の更新に失敗しました',
      details: error.message,
    });
  }
});

/**
 * POST /api/sales-meeting-agenda/:id/complete - 完了/未完了の切り替え
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { completed } = req.body;

    const fields: Record<string, any> = {
      completed: !!completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('sales_meeting_agenda_items')
      .update(fields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to complete sales meeting agenda item:', error);
    res.status(500).json({
      error: '完了状態の更新に失敗しました',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/sales-meeting-agenda/:id - 議題削除
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('sales_meeting_agenda_items')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete sales meeting agenda item:', error);
    res.status(500).json({
      error: '議題の削除に失敗しました',
      details: error.message,
    });
  }
});

export default router;
