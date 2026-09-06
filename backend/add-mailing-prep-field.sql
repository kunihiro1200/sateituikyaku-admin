-- Migration: 郵送準備フィールドの追加
-- 「契約書、重説作成」セクション（契約書確認の横）用の新規チェック項目
-- DB専用（スプシ非同期）

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mailing_prep TEXT;

COMMENT ON COLUMN work_tasks.mailing_prep IS '郵送準備（済/未）- 契約書確認後の郵送準備チェック - DB専用';
