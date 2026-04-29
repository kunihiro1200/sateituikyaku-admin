-- property_listingsテーブルにハウスメーカーカラムを追加
ALTER TABLE property_listings
ADD COLUMN IF NOT EXISTS house_maker TEXT;

COMMENT ON COLUMN property_listings.house_maker IS 'ハウスメーカー（戸建て物件のみ。athomeシートF10セルから同期、またはDB直接入力）';
