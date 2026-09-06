-- ⚠️ Supabase ダッシュボードの SQL Editor でこの内容を実行してください
-- 郵送準備依頼・製本二重チェックの保存失敗を直すために必須のカラム追加
-- （ADD COLUMN IF NOT EXISTS なので何度実行しても安全・非破壊）

ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS mailing_prep TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS binding_double_check TEXT;

COMMENT ON COLUMN work_tasks.mailing_prep IS '郵送準備（依頼/null）- 契約書確認の横の依頼ボタン - DB専用';
COMMENT ON COLUMN work_tasks.binding_double_check IS '製本二重チェック（久/R/和）- チェックしないと製本完了不可 - DB専用';
