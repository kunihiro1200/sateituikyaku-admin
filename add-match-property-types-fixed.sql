-- マッチング機能に物件種別（複数選択）を追加
-- 背景:
--   売主の「売りたい」・「買いたい」マッチング欄、および買主の「買いたい」マッチング欄に
--   物件種別（マンション、戸建て、土地など）を複数選択できるようにする。
--   種別はJSON配列で保存し、マッチング時に相手の種別と積集合が存在するかで判定する。

-- ============================================
-- 売主テーブル: 売りたい（既存 match_* フィールド群）
-- ============================================
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_property_types JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN sellers.match_property_types IS 'マッチング機能（売却側）: 物件種別配列（["マンション","戸建て","土地"]等）';
CREATE INDEX IF NOT EXISTS idx_sellers_match_property_types ON sellers USING GIN (match_property_types);

-- ============================================
-- 売主テーブル: 買いたい（buy_match_* フィールド群）
-- ============================================
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_property_types JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN sellers.buy_match_property_types IS 'マッチング機能（購入側）: 物件種別配列（["マンション","戸建て","土地"]等）';
CREATE INDEX IF NOT EXISTS idx_sellers_buy_match_property_types ON sellers USING GIN (buy_match_property_types);

-- ============================================
-- 買主テーブル: 買いたい（match_* フィールド群）
-- ============================================
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_property_types JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN buyers.match_property_types IS 'マッチング機能（購入側）: 物件種別配列（["マンション","戸建て","土地"]等）';
CREATE INDEX IF NOT EXISTS idx_buyers_match_property_types ON buyers USING GIN (match_property_types);
