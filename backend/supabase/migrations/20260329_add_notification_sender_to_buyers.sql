-- 買主テーブルに通知送信者カラムを追加（冪等）
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS notification_sender TEXT;
