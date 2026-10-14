-- Migration 20261017: seller_attached_document2 にマンション建物情報カラムを追加
-- マンション情報（ApartmentBuildingInfoSection）から自動補完して訪問前に確認できるようにする
-- 管理会社・施工会社は既存カラムを流用

ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS mansion_building_name   TEXT,          -- マンション名
  ADD COLUMN IF NOT EXISTS mansion_built_year_month VARCHAR(7),   -- 築年月（YYYY-MM）
  ADD COLUMN IF NOT EXISTS mansion_floors_above    INTEGER,       -- 地上階数
  ADD COLUMN IF NOT EXISTS mansion_floors_below    INTEGER,       -- 地下階数
  ADD COLUMN IF NOT EXISTS mansion_total_units     INTEGER,       -- 総戸数
  ADD COLUMN IF NOT EXISTS mansion_structure       TEXT,          -- 建物構造
  ADD COLUMN IF NOT EXISTS mansion_developer       TEXT,          -- 分譲会社
  ADD COLUMN IF NOT EXISTS mansion_management_type TEXT,          -- 管理形態
  ADD COLUMN IF NOT EXISTS mansion_has_elevator    TEXT;          -- エレベーター（あり/なし）

COMMENT ON COLUMN seller_attached_document2.mansion_building_name   IS 'マンション名（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_built_year_month IS '築年月 YYYY-MM（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_floors_above    IS '地上階数（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_floors_below    IS '地下階数（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_total_units     IS '総戸数（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_structure       IS '建物構造（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_developer       IS '分譲会社（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_management_type IS '管理形態（外部建物情報から自動補完）';
COMMENT ON COLUMN seller_attached_document2.mansion_has_elevator    IS 'エレベーター（外部建物情報から自動補完）';
