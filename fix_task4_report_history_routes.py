#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
propertyListings.ts: report-history エンドポイントを追加
"""

filepath = 'backend/src/routes/propertyListings.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# import に createClient を追加
old_import = "import { UrlValidator } from '../utils/urlValidator';"
new_import = "import { UrlValidator } from '../utils/urlValidator';\nimport { createClient } from '@supabase/supabase-js';"

text = text.replace(old_import, new_import)

# export default の直前に report-history エンドポイントを追加
old_export = "export default router;"
new_export = """// 報告書送信履歴を取得
router.get('/:propertyNumber/report-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('property_report_history')
      .select('*')
      .eq('property_number', propertyNumber)
      .order('sent_at', { ascending: false })
      .limit(50);
    if (error) {
      // テーブルが存在しない場合は空配列を返す
      res.json([]);
      return;
    }
    res.json(data || []);
  } catch (error: any) {
    console.error('Error fetching report history:', error);
    res.json([]);
  }
});

// 報告書送信履歴を記録
router.post('/:propertyNumber/report-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { template_name, subject, report_date, report_assignee, report_completed } = req.body;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('property_report_history')
      .insert({
        property_number: propertyNumber,
        template_name: template_name || null,
        subject: subject || null,
        report_date: report_date || null,
        report_assignee: report_assignee || null,
        report_completed: report_completed || 'N',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      // テーブルが存在しない場合はエラーを無視
      res.json({ success: false, message: 'Table not found, skipping history record' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error recording report history:', error);
    res.json({ success: false });
  }
});

export default router;"""

text = text.replace(old_export, new_export)

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! report-history endpoints added.')
