-- Migration 164: 添付資料２にハザードマップ・抵当権カラムを追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS hazard_map TEXT,    -- ハザードマップ（水害、土砂災害）
  ADD COLUMN IF NOT EXISTS mortgage_info TEXT; -- 抵当権（抵当権の種類と抵当権先）

COMMENT ON COLUMN seller_attached_document2.hazard_map IS 'ハザードマップ（水害、土砂災害）';
COMMENT ON COLUMN seller_attached_document2.mortgage_info IS '抵当権（抵当権の種類と抵当権先）';
