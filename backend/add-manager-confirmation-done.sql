-- work_tasksテーブルに山本マネージャー確認済みフィールドを追加
-- 売買契約確認=確認OKの場合に必須となる項目

ALTER TABLE work_tasks
ADD COLUMN IF NOT EXISTS manager_confirmation_done TEXT;

COMMENT ON COLUMN work_tasks.manager_confirmation_done IS '山本マネージャーに確認済み（済/NULL）';
