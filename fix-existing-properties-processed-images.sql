-- 既存の全物件のprocessed_imagesをfalseに設定
UPDATE property_previews
SET processed_images = false
WHERE processed_images IS NULL;

-- 確認
SELECT slug, title, processed_images
FROM property_previews
WHERE is_tateuri = true
AND is_active = true
LIMIT 10;
