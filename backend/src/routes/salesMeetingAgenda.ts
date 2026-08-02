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
 * GET /api/sales-meeting-agenda/months - 議題が存在する月一覧を取得
 */
router.get('/months', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data: agendas } = await supabase
      .from('sales_meeting_agendas')
      .select('year_month');
    const { data: todos } = await supabase
      .from('sales_meeting_todos')
      .select('year_month');

    const monthsSet = new Set<string>();
    (agendas || []).forEach((a: any) => monthsSet.add(a.year_month));
    (todos || []).forEach((t: any) => monthsSet.add(t.year_month));

    // 今月を必ず含める
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentYm);

    const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    res.json({ data: months });
  } catch (error: any) {
    console.error('Failed to fetch months:', error);
    res.status(500).json({ error: '月一覧の取得に失敗しました', details: error.message });
  }
});

/**
 * GET /api/sales-meeting-agenda/:yearMonth - 指定月の議題本文＋TODO一覧を取得
 * yearMonth形式: '2026-07'
 */
router.get('/:yearMonth', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const yearMonth = req.params.yearMonth;

    const { data: agenda, error: agendaError } = await supabase
      .from('sales_meeting_agendas')
      .select('*')
      .eq('year_month', yearMonth)
      .maybeSingle();
    if (agendaError) throw agendaError;

    const { data: todos, error: todosError } = await supabase
      .from('sales_meeting_todos')
      .select('*')
      .eq('year_month', yearMonth)
      .order('created_at', { ascending: true });
    if (todosError) throw todosError;

    res.json({
      data: {
        year_month: yearMonth,
        agenda_text: agenda?.agenda_text || '',
        todos: todos || [],
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch agenda for month:', error);
    res.status(500).json({ error: '議題の取得に失敗しました', details: error.message });
  }
});

/**
 * PUT /api/sales-meeting-agenda/:yearMonth - 指定月の議題本文を保存（upsert）
 */
router.put('/:yearMonth', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const yearMonth = req.params.yearMonth;
    const { agenda_text } = req.body;

    const { data: existing } = await supabase
      .from('sales_meeting_agendas')
      .select('id')
      .eq('year_month', yearMonth)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabase
        .from('sales_meeting_agendas')
        .update({ agenda_text: agenda_text ?? null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('sales_meeting_agendas')
        .insert({ year_month: yearMonth, agenda_text: agenda_text ?? null })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({ data: result.data });
  } catch (error: any) {
    console.error('Failed to save agenda:', error);
    res.status(500).json({ error: '議題の保存に失敗しました', details: error.message });
  }
});

/**
 * POST /api/sales-meeting-agenda/:yearMonth/todos - TODO新規作成
 */
router.post('/:yearMonth/todos', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const yearMonth = req.params.yearMonth;
    const { content, assignee, due_date, remarks, created_by } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'TODO内容を入力してください' });
    }

    const { data, error } = await supabase
      .from('sales_meeting_todos')
      .insert({
        year_month: yearMonth,
        content: content.trim(),
        assignee: assignee ?? null,
        due_date: due_date || null,
        remarks: remarks ?? null,
        created_by: created_by ?? null,
        completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to create todo:', error);
    res.status(500).json({ error: 'TODOの作成に失敗しました', details: error.message });
  }
});

/**
 * PUT /api/sales-meeting-agenda/todos/:id - TODO更新
 */
router.put('/todos/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { content, assignee, due_date, remarks } = req.body;

    const fields: Record<string, any> = { updated_at: new Date().toISOString() };
    if (content !== undefined) fields.content = content;
    if (assignee !== undefined) fields.assignee = assignee;
    if (due_date !== undefined) fields.due_date = due_date || null;
    if (remarks !== undefined) fields.remarks = remarks;

    const { data, error } = await supabase
      .from('sales_meeting_todos')
      .update(fields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to update todo:', error);
    res.status(500).json({ error: 'TODOの更新に失敗しました', details: error.message });
  }
});

/**
 * POST /api/sales-meeting-agenda/todos/:id/complete - TODOの完了/未完了切り替え
 */
router.post('/todos/:id/complete', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { completed } = req.body;

    const fields: Record<string, any> = {
      completed: !!completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('sales_meeting_todos')
      .update(fields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Failed to complete todo:', error);
    res.status(500).json({ error: '完了状態の更新に失敗しました', details: error.message });
  }
});

/**
 * DELETE /api/sales-meeting-agenda/todos/:id - TODO削除
 */
router.delete('/todos/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('sales_meeting_todos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete todo:', error);
    res.status(500).json({ error: 'TODOの削除に失敗しました', details: error.message });
  }
});

export default router;
