-- 他社物件登録機能のためのカラム追加
-- special_notes: 特記事項（発行会社（他社）の情報を保存）
-- company_name: 取引業者名（当社情報を保存）

ALTER TABLE property_listings
ADD COLUMN IF NOT EXISTS special_notes TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT;

COMMENT ON COLUMN property_listings.special_notes IS '特記事項（他社物件の発行会社情報など）';
COMMENT ON COLUMN property_listings.company_name IS '取引業者名（当社情報）';
