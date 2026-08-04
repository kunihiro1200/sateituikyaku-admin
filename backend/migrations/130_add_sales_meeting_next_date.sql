-- ============================================================================
-- 130 営業会議の「次回開催日」を保存するテーブルを追加
-- 議題ページのヘッダーで編集可能にし、Cron通知の対象日として利用する
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_meeting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  next_meeting_date DATE NOT NULL,  -- 次回営業会議の開催日（毎月第1月曜がデフォルト、手動編集可）
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_meeting_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON sales_meeting_settings;
CREATE POLICY "service_role_all" ON sales_meeting_settings
  FOR ALL USING (true) WITH CHECK (true);

SELECT pg_notify('pgrst', 'reload schema');

DO $$
BEGIN
  RAISE NOTICE '✅ 130: sales_meeting_settings テーブルを作成しました';
END $$;
