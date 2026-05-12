-- property_previewsテーブルにregionカラムを追加
-- 大分建売専門HP（oita）と福岡建売専門HP（fukuoka）を区別するため

ALTER TABLE property_previews
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'oita';

-- 既存のis_tateuri=trueのレコードは全てoitaとして扱う
UPDATE property_previews
SET region = 'oita'
WHERE is_tateuri = true AND region IS NULL;

-- regionカラムにインデックスを追加（検索高速化）
CREATE INDEX IF NOT EXISTS idx_property_previews_region 
ON property_previews(region) 
WHERE is_tateuri = true AND is_active = true;

-- 確認
SELECT 
  region,
  COUNT(*) as count
FROM property_previews
WHERE is_tateuri = true AND is_active = true
GROUP BY region
ORDER BY region;
