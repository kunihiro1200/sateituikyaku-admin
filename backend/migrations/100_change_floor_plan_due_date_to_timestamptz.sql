-- 間取図完了予定（floor_plan_due_date）を DATE から TIMESTAMPTZ に変更
-- 理由: スプレッドシートにタイムスタンプ（日時）が入力されており、時刻情報も保存する必要があるため

ALTER TABLE work_tasks
  ALTER COLUMN floor_plan_due_date TYPE TIMESTAMPTZ
  USING floor_plan_due_date::TIMESTAMPTZ;

COMMENT ON COLUMN work_tasks.floor_plan_due_date IS '間取図完了予定（タイムスタンプ）';
