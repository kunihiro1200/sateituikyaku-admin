-- Migration 126: 評価ポイントの追加行対応（11以降、5以降）
-- 固定10 + 4カラムに加えて、追加分をJSONB配列で保存

ALTER TABLE seller_evaluation_points
ADD COLUMN IF NOT EXISTS extra_points JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS extra_cautions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN seller_evaluation_points.extra_points IS '追加おすすめポイント（11以降）JSON配列';
COMMENT ON COLUMN seller_evaluation_points.extra_cautions IS '追加注意点（5以降）JSON配列';
