-- Migration 159: 訪問準備「添付資料２」用テーブル作成
-- 通話モードページの訪問準備ポップアップから開く印刷用A4資料（小学校・中学校・最寄り駅等）

CREATE TABLE IF NOT EXISTS seller_attached_document2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

    elementary_school TEXT,               -- 小学校
    junior_high_school TEXT,              -- 中学校
    nearest_station TEXT,                 -- 最寄り駅
    nearest_bus_stop TEXT,                -- 最寄りバス停
    currently_listed_same_building TEXT,  -- 現在募集中（同マンション）
    other_nearby_cases TEXT,              -- 他の周辺事例
    comparison_list TEXT,                 -- 比較リスト

    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,

    -- 1売主に1レコード
    CONSTRAINT unique_seller_attached_document2 UNIQUE (seller_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_seller_attached_document2_seller_id ON seller_attached_document2(seller_id);

COMMENT ON TABLE seller_attached_document2 IS '訪問準備「添付資料２」の入力項目（小学校・中学校・最寄り駅・最寄りバス停・現在募集中（同マンション）・他の周辺事例・比較リスト）';
COMMENT ON COLUMN seller_attached_document2.elementary_school IS '小学校';
COMMENT ON COLUMN seller_attached_document2.junior_high_school IS '中学校';
COMMENT ON COLUMN seller_attached_document2.nearest_station IS '最寄り駅';
COMMENT ON COLUMN seller_attached_document2.nearest_bus_stop IS '最寄りバス停';
COMMENT ON COLUMN seller_attached_document2.currently_listed_same_building IS '現在募集中（同マンション）';
COMMENT ON COLUMN seller_attached_document2.other_nearby_cases IS '他の周辺事例';
COMMENT ON COLUMN seller_attached_document2.comparison_list IS '比較リスト';
