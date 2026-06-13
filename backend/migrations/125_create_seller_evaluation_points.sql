-- Migration 125: 売主ごとの評価ポイントテーブル作成
-- 訪問準備の「物件の評価ポイント！おすすめポイント！」をシステム上で管理

CREATE TABLE IF NOT EXISTS seller_evaluation_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    
    -- おすすめポイント（10項目）
    point_1 TEXT,
    point_2 TEXT,
    point_3 TEXT,
    point_4 TEXT,
    point_5 TEXT,
    point_6 TEXT,
    point_7 TEXT,
    point_8 TEXT,
    point_9 TEXT,
    point_10 TEXT,
    
    -- 注意点（告知事項等）（4項目）
    caution_1 TEXT,
    caution_2 TEXT,
    caution_3 TEXT,
    caution_4 TEXT,
    
    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    
    -- 1売主に1レコード
    CONSTRAINT unique_seller_evaluation UNIQUE (seller_id)
);

-- インデックス
CREATE INDEX idx_seller_evaluation_points_seller_id ON seller_evaluation_points(seller_id);

COMMENT ON TABLE seller_evaluation_points IS '売主ごとの物件評価ポイント（おすすめポイント10個 + 注意点4個）';
COMMENT ON COLUMN seller_evaluation_points.point_1 IS 'おすすめポイント1';
COMMENT ON COLUMN seller_evaluation_points.point_2 IS 'おすすめポイント2';
COMMENT ON COLUMN seller_evaluation_points.point_3 IS 'おすすめポイント3';
COMMENT ON COLUMN seller_evaluation_points.point_4 IS 'おすすめポイント4';
COMMENT ON COLUMN seller_evaluation_points.point_5 IS 'おすすめポイント5';
COMMENT ON COLUMN seller_evaluation_points.point_6 IS 'おすすめポイント6';
COMMENT ON COLUMN seller_evaluation_points.point_7 IS 'おすすめポイント7';
COMMENT ON COLUMN seller_evaluation_points.point_8 IS 'おすすめポイント8';
COMMENT ON COLUMN seller_evaluation_points.point_9 IS 'おすすめポイント9';
COMMENT ON COLUMN seller_evaluation_points.point_10 IS 'おすすめポイント10';
COMMENT ON COLUMN seller_evaluation_points.caution_1 IS '注意点（告知事項等）1';
COMMENT ON COLUMN seller_evaluation_points.caution_2 IS '注意点（告知事項等）2';
COMMENT ON COLUMN seller_evaluation_points.caution_3 IS '注意点（告知事項等）3';
COMMENT ON COLUMN seller_evaluation_points.caution_4 IS '注意点（告知事項等）4';
