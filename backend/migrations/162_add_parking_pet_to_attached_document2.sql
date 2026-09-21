-- Migration 162: 添付資料２に駐車場・ペットカラムを追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS parking TEXT,  -- 駐車場
  ADD COLUMN IF NOT EXISTS pet TEXT;      -- ペット（マンション用）

COMMENT ON COLUMN seller_attached_document2.parking IS '駐車場（全種別）';
COMMENT ON COLUMN seller_attached_document2.pet IS 'ペット（マンション用）';
