-- 売主テーブルにメール担当系カラムを追加（スプシ同期対応）
-- 対象カラム: CV列「訪問事前通知メール担当」など7カラム
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_reminder_assignee TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS unreachable_sms_assignee TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_sms_assignee TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_reason_email_assignee TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS cancel_notice_assignee TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS long_term_email_assignee TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS call_reminder_email_assignee TEXT;
