-- sales_meeting_agenda_items テーブル
-- 「営業会議」の「議題」機能用（決定事項の管理）
-- スプレッドシートには保存しない、DB専用

CREATE TABLE IF NOT EXISTS sales_meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,              -- 例：「2026年7月決定事項」
  content TEXT,                     -- ロングテキストの決定内容
  assignee TEXT,                    -- 誰が
  due_date DATE,                    -- いつまで
  completed BOOLEAN NOT NULL DEFAULT false,  -- 完了フラグ
  completed_at TIMESTAMPTZ,         -- 完了日時
  created_by TEXT,                  -- 入力者
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_meeting_agenda_items_completed
  ON sales_meeting_agenda_items(completed);

CREATE INDEX IF NOT EXISTS idx_sales_meeting_agenda_items_created_at
  ON sales_meeting_agenda_items(created_at DESC);

ALTER TABLE sales_meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON sales_meeting_agenda_items
  FOR ALL USING (true) WITH CHECK (true);
