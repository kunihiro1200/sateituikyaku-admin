-- 比較マップ：確認済み位置情報テーブル
-- Google Maps API由来の座標と自社確認の座標を管理
CREATE TABLE IF NOT EXISTS comparison_map_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  place_id TEXT,
  coordinate_source TEXT NOT NULL DEFAULT 'geocoding_api',
  -- 確認ステータス: 未確認 / 確認済み / 要修正
  confirmation_status TEXT NOT NULL DEFAULT '未確認',
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 比較マップ：作成済み比較資料のスナップショット
CREATE TABLE IF NOT EXISTS comparison_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number TEXT,
  map_title TEXT,
  -- 査定対象物件 (JSON: SubjectProperty)
  subject_property JSONB NOT NULL DEFAULT '{}',
  -- 競合物件リスト (JSON: CompetingProperty[])
  competing_properties JSONB NOT NULL DEFAULT '[]',
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_maps_seller_id ON comparison_maps(seller_id);
CREATE INDEX IF NOT EXISTS idx_comparison_maps_seller_number ON comparison_maps(seller_number);
CREATE INDEX IF NOT EXISTS idx_comparison_map_locations_address ON comparison_map_locations(address);
