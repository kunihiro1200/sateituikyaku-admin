-- 媒介契約セルフチェック項目をwork_tasksテーブルに追加
ALTER TABLE work_tasks
ADD COLUMN IF NOT EXISTS mediation_self_check JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN work_tasks.mediation_self_check IS '媒介契約セルフチェック項目（複数選択可能なチェックリスト）';
