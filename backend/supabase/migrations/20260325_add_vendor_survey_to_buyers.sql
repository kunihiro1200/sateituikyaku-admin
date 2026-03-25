-- 買主テーブルに業者向けアンケートカラムを追加
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS vendor_survey TEXT;
