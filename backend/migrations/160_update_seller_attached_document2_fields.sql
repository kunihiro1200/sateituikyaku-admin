-- Migration 160: 添付資料２の項目を種別（マンション／マンション以外）で分岐させる
-- 「現在募集中（同マンション）」「他の周辺事例」「比較リスト」を削除し、
-- マンション用（チェックボックス3種 + 管理費/修繕積立金）と
-- マンション以外用（現在の近隣募集中/過去成約事例 + 境界標/道路幅/接道）に置き換える

ALTER TABLE seller_attached_document2
  DROP COLUMN IF EXISTS currently_listed_same_building,
  DROP COLUMN IF EXISTS other_nearby_cases,
  DROP COLUMN IF EXISTS comparison_list;

ALTER TABLE seller_attached_document2
  -- マンション用：横並びチェックボックス3種
  ADD COLUMN IF NOT EXISTS currently_listed_same_building_checked BOOLEAN DEFAULT FALSE, -- 現在募集中（同マンション）
  ADD COLUMN IF NOT EXISTS same_building_sold_case_checked BOOLEAN DEFAULT FALSE,        -- 同マンションの成約事例
  ADD COLUMN IF NOT EXISTS nearby_mansion_sold_case_checked BOOLEAN DEFAULT FALSE,       -- 周辺のマンションの成約事例
  -- マンション用：管理費・修繕積立金（横並び）
  ADD COLUMN IF NOT EXISTS management_fee TEXT,       -- 管理費
  ADD COLUMN IF NOT EXISTS repair_reserve_fund TEXT,  -- 修繕積立金
  -- マンション以外用：テキスト入力2種
  ADD COLUMN IF NOT EXISTS current_nearby_listing TEXT, -- 現在の近隣募集中
  ADD COLUMN IF NOT EXISTS past_sold_case TEXT,         -- 過去成約事例
  -- マンション以外用：境界標・道路幅・接道（横並び）
  ADD COLUMN IF NOT EXISTS boundary_stake TEXT,  -- 境界に杭あるか
  ADD COLUMN IF NOT EXISTS road_width TEXT,      -- 道路幅
  ADD COLUMN IF NOT EXISTS road_contact TEXT;    -- 接道

COMMENT ON COLUMN seller_attached_document2.currently_listed_same_building_checked IS '現在募集中（同マンション）チェック（マンション用）';
COMMENT ON COLUMN seller_attached_document2.same_building_sold_case_checked IS '同マンションの成約事例チェック（マンション用）';
COMMENT ON COLUMN seller_attached_document2.nearby_mansion_sold_case_checked IS '周辺のマンションの成約事例チェック（マンション用）';
COMMENT ON COLUMN seller_attached_document2.management_fee IS '管理費（マンション用）';
COMMENT ON COLUMN seller_attached_document2.repair_reserve_fund IS '修繕積立金（マンション用）';
COMMENT ON COLUMN seller_attached_document2.current_nearby_listing IS '現在の近隣募集中（マンション以外用）';
COMMENT ON COLUMN seller_attached_document2.past_sold_case IS '過去成約事例（マンション以外用）';
COMMENT ON COLUMN seller_attached_document2.boundary_stake IS '境界に杭あるか（マンション以外用）';
COMMENT ON COLUMN seller_attached_document2.road_width IS '道路幅（マンション以外用）';
COMMENT ON COLUMN seller_attached_document2.road_contact IS '接道（マンション以外用）';
