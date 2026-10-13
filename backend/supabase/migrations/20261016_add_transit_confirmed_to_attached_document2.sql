-- Migration 20261016: seller_attached_document2 に交通アクセス確認チェックボックスを追加
-- 最寄り駅・最寄りバス停の確認状況を保存するカラムを追加する

ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS nearest_station_confirmed   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_confirmed  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN seller_attached_document2.nearest_station_confirmed   IS '最寄り駅情報の確認済みフラグ';
COMMENT ON COLUMN seller_attached_document2.nearest_bus_stop_confirmed  IS '最寄りバス停情報の確認済みフラグ';
