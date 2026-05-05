-- 買主テーブルに案件担当カラムを追加
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS project_assignee TEXT;

COMMENT ON COLUMN buyers.project_assignee IS '案件担当（スタッフのイニシャル）';
