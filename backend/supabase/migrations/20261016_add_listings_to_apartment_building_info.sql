-- Migration 20261016: seller_apartment_building_info に現在の売り出し情報カラムを追加
-- listings: JSONB配列 [{url, floor, area_sqm, price_yen, price_label, room_type}]

ALTER TABLE seller_apartment_building_info
  ADD COLUMN IF NOT EXISTS listings            JSONB,
  ADD COLUMN IF NOT EXISTS listings_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN seller_apartment_building_info.listings IS
  '現在の売り出し物件一覧（JSONB配列: url/floor/area_sqm/price_yen/price_label/room_type）';
COMMENT ON COLUMN seller_apartment_building_info.listings_fetched_at IS
  '売り出し情報の最終取得日時';
