-- Migration: 添付資料２に新規フィールドを追加
-- 道路の種類・売却理由・境界・ガス/排水・建築会社・管理会社

ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS road_type            TEXT,                    -- 道路の種類（旧:抵当権）
  ADD COLUMN IF NOT EXISTS sale_reason          TEXT,                    -- 売却理由
  ADD COLUMN IF NOT EXISTS boundary_info        TEXT,                    -- 境界（杭あり/なし/越境物）
  ADD COLUMN IF NOT EXISTS gas_propane          BOOLEAN DEFAULT FALSE,   -- ガス：プロパン
  ADD COLUMN IF NOT EXISTS gas_city_gas         BOOLEAN DEFAULT FALSE,   -- ガス：都市ガス
  ADD COLUMN IF NOT EXISTS drainage_public      BOOLEAN DEFAULT FALSE,   -- 排水：公共下水
  ADD COLUMN IF NOT EXISTS drainage_septic      BOOLEAN DEFAULT FALSE,   -- 排水：浄化槽
  ADD COLUMN IF NOT EXISTS drainage_cesspool    BOOLEAN DEFAULT FALSE,   -- 排水：汲み取り
  ADD COLUMN IF NOT EXISTS construction_company TEXT,                    -- 建築会社
  ADD COLUMN IF NOT EXISTS management_company   TEXT;                    -- 管理会社（マンション用）

COMMENT ON COLUMN seller_attached_document2.road_type            IS '道路の種類';
COMMENT ON COLUMN seller_attached_document2.sale_reason          IS '売却理由';
COMMENT ON COLUMN seller_attached_document2.boundary_info        IS '境界（杭あり/なし/越境物）';
COMMENT ON COLUMN seller_attached_document2.gas_propane          IS 'ガス：プロパン';
COMMENT ON COLUMN seller_attached_document2.gas_city_gas         IS 'ガス：都市ガス';
COMMENT ON COLUMN seller_attached_document2.drainage_public      IS '排水：公共下水';
COMMENT ON COLUMN seller_attached_document2.drainage_septic      IS '排水：浄化槽';
COMMENT ON COLUMN seller_attached_document2.drainage_cesspool    IS '排水：汲み取り';
COMMENT ON COLUMN seller_attached_document2.construction_company IS '建築会社';
COMMENT ON COLUMN seller_attached_document2.management_company   IS '管理会社（マンション用）';

-- スキーマキャッシュを更新
NOTIFY pgrst, 'reload schema';
