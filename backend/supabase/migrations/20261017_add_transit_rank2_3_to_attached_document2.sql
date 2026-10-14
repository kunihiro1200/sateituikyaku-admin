-- Migration 20261017: seller_attached_document2 に最寄り駅・バス停の2件目・3件目カラムを追加
-- FI売主（福岡店）は最大3件取得するため、rank2/rank3 用のフィールドを追加する

ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS nearest_station_name_2      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_station_walk_2      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_station_confirmed_2 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearest_station_name_3      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_station_walk_3      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_station_confirmed_3 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_name_2      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_walk_2      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_confirmed_2 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_name_3      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_walk_3      TEXT,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_confirmed_3 BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN seller_attached_document2.nearest_station_name_2      IS '最寄り駅2件目名称（FI売主用）';
COMMENT ON COLUMN seller_attached_document2.nearest_station_name_3      IS '最寄り駅3件目名称（FI売主用）';
COMMENT ON COLUMN seller_attached_document2.nearest_bus_stop_name_2     IS '最寄りバス停2件目名称（FI売主用）';
COMMENT ON COLUMN seller_attached_document2.nearest_bus_stop_name_3     IS '最寄りバス停3件目名称（FI売主用）';
