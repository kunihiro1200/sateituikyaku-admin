-- サイト登録修正・間取図修正フィールドの追加
-- DBのみで管理（スプレッドシートには同期しない）

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS site_registration_revision TEXT,
  ADD COLUMN IF NOT EXISTS site_registration_revision_content TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_revision_correction TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_revision_correction_content TEXT;

-- コメント
COMMENT ON COLUMN work_tasks.site_registration_revision IS 'サイト登録修正（あり/なし）';
COMMENT ON COLUMN work_tasks.site_registration_revision_content IS 'サイト登録修正内容（ロングテキスト）';
COMMENT ON COLUMN work_tasks.floor_plan_revision_correction IS '間取図修正（当社ミス）（あり/なし）';
COMMENT ON COLUMN work_tasks.floor_plan_revision_correction_content IS '間取図修正内容（ロングテキスト）';
