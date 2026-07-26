-- 気づき一覧の対策・完了管理用カラム追加
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_insight_action TEXT DEFAULT NULL;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_insight_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_insight_ai_analysis TEXT DEFAULT NULL;
