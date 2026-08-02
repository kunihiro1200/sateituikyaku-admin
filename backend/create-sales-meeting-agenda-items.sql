-- 営業会議「議題」機能（月別）
-- sales_meeting_agendas: 月ごとの議題本文（ロングテキスト）
-- sales_meeting_todos: 月ごとのTODOリスト（誰が・いつまで・完了）
-- スプレッドシートには保存しない、DB専用

CREATE TABLE IF NOT EXISTS sales_meeting_agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL UNIQUE,   -- 例: '2026-07'
  agenda_text TEXT,                  -- 議題本文（ロングテキスト）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_meeting_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,          -- 例: '2026-07'
  content TEXT NOT NULL,             -- TODO内容
  assignee TEXT,                     -- 誰が
  due_date DATE,                     -- いつまで
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_meeting_todos_year_month
  ON sales_meeting_todos(year_month);
CREATE INDEX IF NOT EXISTS idx_sales_meeting_todos_completed
  ON sales_meeting_todos(completed);

ALTER TABLE sales_meeting_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_meeting_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON sales_meeting_agendas;
CREATE POLICY "service_role_all" ON sales_meeting_agendas
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON sales_meeting_todos;
CREATE POLICY "service_role_all" ON sales_meeting_todos
  FOR ALL USING (true) WITH CHECK (true);

-- 旧テーブル（不要な場合は削除可）
DROP TABLE IF EXISTS sales_meeting_agenda_items;

SELECT pg_notify('pgrst', 'reload schema');

-- 備考カラム追加
ALTER TABLE sales_meeting_todos ADD COLUMN IF NOT EXISTS remarks TEXT;

SELECT pg_notify('pgrst', 'reload schema');
