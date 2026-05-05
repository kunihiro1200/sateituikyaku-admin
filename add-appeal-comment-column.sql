-- property_previewsテーブルにおすすめコメントカラムを追加
ALTER TABLE property_previews ADD COLUMN IF NOT EXISTS appeal_comment TEXT;
