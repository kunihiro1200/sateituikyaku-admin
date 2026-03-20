-- Migration 101: sellersテーブルに担当者設定フィールドを追加
-- Feature: call-mode-assignee-section
-- 
-- 追加カラム:
--   unreachable_sms_assignee       - 不通時Sメール担当（CS列）
--   valuation_sms_assignee         - 査定Sメール担当（CT列）
--   valuation_reason_email_assignee - 査定理由別３後Eメ担（DL列）
--   valuation_reason               - 査定理由（AO列）
--   cancel_notice_assignee         - キャンセル案内担当（AF列）
--   long_term_email_assignee       - 除外前、長期客メール担当（CX列）
--   call_reminder_email_assignee   - 当社が電話したというリマインドメール担当（CO列）

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS unreachable_sms_assignee TEXT,
  ADD COLUMN IF NOT EXISTS valuation_sms_assignee TEXT,
  ADD COLUMN IF NOT EXISTS valuation_reason_email_assignee TEXT,
  ADD COLUMN IF NOT EXISTS valuation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancel_notice_assignee TEXT,
  ADD COLUMN IF NOT EXISTS long_term_email_assignee TEXT,
  ADD COLUMN IF NOT EXISTS call_reminder_email_assignee TEXT;
