-- 司法書士連絡先（メールアドレス）カラムを追加
-- DB専用フィールド（スプシ非同期）

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS judicial_scrivener_email TEXT;

COMMENT ON COLUMN work_tasks.judicial_scrivener_email IS '司法書士連絡先（メールアドレス）- DB専用';
