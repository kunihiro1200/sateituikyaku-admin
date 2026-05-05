-- property_previewsテーブルにpointsカラムを追加
-- ポイント（設備・仕様・構造など）の情報を配列で保存

ALTER TABLE property_previews
ADD COLUMN IF NOT EXISTS points JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN property_previews.points IS 'ポイント（設備・仕様・構造など）の情報配列';
