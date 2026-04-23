-- Migration: 116_add_mediation_checker_fields
-- Description: 媒介確認者・媒介契約修正関連カラムをwork_tasksテーブルに追加
-- Created: 2026-04-23

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mediation_checker TEXT,
  ADD COLUMN IF NOT EXISTS mediation_revision TEXT,
  ADD COLUMN IF NOT EXISTS mediation_revision_content TEXT;

COMMENT ON COLUMN work_tasks.mediation_checker IS '媒介確認者（スプレッドシートEH列）';
COMMENT ON COLUMN work_tasks.mediation_revision IS '媒介契約修正（あり/なし）';
COMMENT ON COLUMN work_tasks.mediation_revision_content IS '媒介契約修正内容（ロングテキスト）';
