-- property_previewsテーブルに画像加工フラグカラムを追加
ALTER TABLE property_previews
ADD COLUMN IF NOT EXISTS processed_images BOOLEAN DEFAULT FALSE;

-- カラムの説明
COMMENT ON COLUMN property_previews.processed_images IS '画像加工済みフラグ（true=角度・拡大・帯を適用）';
