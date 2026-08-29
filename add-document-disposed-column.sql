-- 物件資料処分済カラムを追加（ATBB状況が「非公開」の場合に「済」「未」を記録）
ALTER TABLE property_listings ADD COLUMN IF NOT EXISTS document_disposed TEXT;
