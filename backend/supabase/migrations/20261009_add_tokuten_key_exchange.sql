-- Migration: 添付資料２に【特典】鍵交換チェックボックスを追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS tokuten_key_exchange BOOLEAN DEFAULT FALSE; -- 鍵交換

COMMENT ON COLUMN seller_attached_document2.tokuten_key_exchange IS '【特典】鍵交換';
