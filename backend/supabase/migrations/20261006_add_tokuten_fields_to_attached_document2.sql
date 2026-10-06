-- Migration: 添付資料２に【特典】チェックボックス7種を追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS tokuten_cleaning      BOOLEAN DEFAULT FALSE, -- 室内クリーニング
  ADD COLUMN IF NOT EXISTS tokuten_garden        BOOLEAN DEFAULT FALSE, -- 庭の除草、草刈り
  ADD COLUMN IF NOT EXISTS tokuten_wallpaper     BOOLEAN DEFAULT FALSE, -- クロスの張替え
  ADD COLUMN IF NOT EXISTS tokuten_removal       BOOLEAN DEFAULT FALSE, -- 残置物撤去
  ADD COLUMN IF NOT EXISTS tokuten_warranty      BOOLEAN DEFAULT FALSE, -- 設備の1年間無償保証
  ADD COLUMN IF NOT EXISTS tokuten_fee_discount  BOOLEAN DEFAULT FALSE, -- 最低価格を下回った場合 仲介手数料２％
  ADD COLUMN IF NOT EXISTS tokuten_bridge_loan   BOOLEAN DEFAULT FALSE; -- つなぎ融資

COMMENT ON COLUMN seller_attached_document2.tokuten_cleaning     IS '【特典】室内クリーニング';
COMMENT ON COLUMN seller_attached_document2.tokuten_garden       IS '【特典】庭の除草、草刈り';
COMMENT ON COLUMN seller_attached_document2.tokuten_wallpaper    IS '【特典】クロスの張替え';
COMMENT ON COLUMN seller_attached_document2.tokuten_removal      IS '【特典】残置物撤去';
COMMENT ON COLUMN seller_attached_document2.tokuten_warranty     IS '【特典】設備の1年間無償保証';
COMMENT ON COLUMN seller_attached_document2.tokuten_fee_discount IS '【特典】最低価格を下回った場合 仲介手数料２％';
COMMENT ON COLUMN seller_attached_document2.tokuten_bridge_loan  IS '【特典】つなぎ融資';
