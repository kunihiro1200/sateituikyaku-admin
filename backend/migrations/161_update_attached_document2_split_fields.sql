-- Migration 161: 添付資料２の項目を詳細分割
-- 小学校・中学校・最寄り駅・バス停を「名称」「徒歩分」に分割
-- 現在の近隣募集中・過去成約事例をテキストからbooleanに変更
-- 固定資産税テキスト欄を追加

-- 旧カラム削除
ALTER TABLE seller_attached_document2
  DROP COLUMN IF EXISTS elementary_school,
  DROP COLUMN IF EXISTS junior_high_school,
  DROP COLUMN IF EXISTS nearest_station,
  DROP COLUMN IF EXISTS nearest_bus_stop,
  DROP COLUMN IF EXISTS current_nearby_listing,
  DROP COLUMN IF EXISTS past_sold_case;

-- 新カラム追加
ALTER TABLE seller_attached_document2
  -- 小学校（名称・徒歩分）
  ADD COLUMN IF NOT EXISTS elementary_school_name TEXT,
  ADD COLUMN IF NOT EXISTS elementary_school_walk TEXT,
  -- 中学校（名称・徒歩分）
  ADD COLUMN IF NOT EXISTS junior_high_school_name TEXT,
  ADD COLUMN IF NOT EXISTS junior_high_school_walk TEXT,
  -- 最寄り駅（名称・徒歩分）
  ADD COLUMN IF NOT EXISTS nearest_station_name TEXT,
  ADD COLUMN IF NOT EXISTS nearest_station_walk TEXT,
  -- 最寄りバス停（名称・徒歩分）
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_name TEXT,
  ADD COLUMN IF NOT EXISTS nearest_bus_stop_walk TEXT,
  -- マンション以外：チェックボックス
  ADD COLUMN IF NOT EXISTS current_nearby_listing_checked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS past_sold_case_checked BOOLEAN DEFAULT FALSE,
  -- 固定資産税（全種別共通）
  ADD COLUMN IF NOT EXISTS property_tax TEXT;

COMMENT ON COLUMN seller_attached_document2.elementary_school_name IS '小学校名';
COMMENT ON COLUMN seller_attached_document2.elementary_school_walk IS '小学校 徒歩分';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_name IS '中学校名';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_walk IS '中学校 徒歩分';
COMMENT ON COLUMN seller_attached_document2.nearest_station_name IS '最寄り駅名';
COMMENT ON COLUMN seller_attached_document2.nearest_station_walk IS '最寄り駅 徒歩分';
COMMENT ON COLUMN seller_attached_document2.nearest_bus_stop_name IS '最寄りバス停名';
COMMENT ON COLUMN seller_attached_document2.nearest_bus_stop_walk IS '最寄りバス停 徒歩分';
COMMENT ON COLUMN seller_attached_document2.current_nearby_listing_checked IS '現在の近隣募集中チェック（マンション以外用）';
COMMENT ON COLUMN seller_attached_document2.past_sold_case_checked IS '過去成約事例チェック（マンション以外用）';
COMMENT ON COLUMN seller_attached_document2.property_tax IS '固定資産税';
