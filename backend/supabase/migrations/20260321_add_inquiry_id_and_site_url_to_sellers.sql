-- 売主テーブルにinquiry_id（スプシD列）とsite_url（スプシAP列）を追加
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS inquiry_id TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS site_url TEXT;
