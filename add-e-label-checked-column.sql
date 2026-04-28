-- Eラベルチェックカラムを追加
ALTER TABLE property_listings ADD COLUMN IF NOT EXISTS e_label_checked TEXT;
