-- site_registration_due_date を DATE から TIMESTAMPTZ に変更
-- 理由: スプレッドシートにタイムスタンプ（日時）が入力されており、時刻情報も保存する必要があるため
-- 参考: migration 100 で floor_plan_due_date に同様の変更を実施済み

ALTER TABLE work_tasks
  ALTER COLUMN site_registration_due_date TYPE TIMESTAMPTZ
  USING site_registration_due_date::TIMESTAMPTZ;

COMMENT ON COLUMN work_tasks.site_registration_due_date IS 'サイト登録納期予定日（タイムスタンプ）';
