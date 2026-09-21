-- Migration 163: 添付資料２に現地調査チェックリストのmemoカラムを追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS site_check_memo1 TEXT,  -- 境界・越境 memo
  ADD COLUMN IF NOT EXISTS site_check_memo2 TEXT,  -- 配水管・浄化槽 memo
  ADD COLUMN IF NOT EXISTS site_check_memo3 TEXT,  -- 擁壁・崖 memo
  ADD COLUMN IF NOT EXISTS site_check_memo4 TEXT;  -- 都市ガス・プロパン memo

COMMENT ON COLUMN seller_attached_document2.site_check_memo1 IS '現地調査memo1（境界・越境）';
COMMENT ON COLUMN seller_attached_document2.site_check_memo2 IS '現地調査memo2（配水管・浄化槽）';
COMMENT ON COLUMN seller_attached_document2.site_check_memo3 IS '現地調査memo3（擁壁・崖）';
COMMENT ON COLUMN seller_attached_document2.site_check_memo4 IS '現地調査memo4（都市ガス・プロパン）';
