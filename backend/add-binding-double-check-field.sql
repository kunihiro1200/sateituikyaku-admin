-- Migration: 製本二重チェックフィールドの追加
-- 「契約書、重説作成」セクションの製本予定日と製本完了の間に配置
-- 久 / R / 和 のいずれかがチェックしないと製本完了を押せない
-- DB専用（スプシ非同期）

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS binding_double_check TEXT;

COMMENT ON COLUMN work_tasks.binding_double_check IS '製本二重チェック（久/R/和）- チェックしないと製本完了不可 - DB専用';
