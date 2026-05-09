-- property_previewsテーブルにregionカラムを追加
-- 'oita'（大分）または 'fukuoka'（福岡）を格納
-- 既存データはすべて 'oita' として扱う

ALTER TABLE property_previews
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'oita';

-- 既存の is_tateuri = true のレコードを 'oita' に設定（デフォルト値で自動設定済みだが念のため）
UPDATE property_previews
  SET region = 'oita'
  WHERE is_tateuri = true AND region IS NULL;

-- インデックス追加（regionでの絞り込みを高速化）
CREATE INDEX IF NOT EXISTS idx_property_previews_region
  ON property_previews (region)
  WHERE is_active = true;
