-- Migration: 127_add_athome_pre_visit_notice_confirmed
-- Description: work_tasksテーブルにathome事前訪問通知確認フィールドを追加
-- 理由: フロントエンドで使用されているが、DBカラムが未作成のため保存時にエラーが発生していた
-- Created: 2026-07-11

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS athome_pre_visit_notice_hidden_confirmed TEXT;

COMMENT ON COLUMN work_tasks.athome_pre_visit_notice_hidden_confirmed IS 'athome事前訪問通知確認済みフラグ（はい/NULL）- 物件一覧行追加済+地積測量図未格納時のバリデーション用';
