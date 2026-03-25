-- 買主テーブルにPinrichカラムを追加
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS pinrich TEXT;
