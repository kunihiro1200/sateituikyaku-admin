-- land_area_verified と building_area_verified の型を BOOLEAN → NUMERIC に変更
-- 「土地（当社調べ）」「建物（当社調べ）」は面積（数値）であり、BOOLEAN型は誤り

ALTER TABLE sellers
  ALTER COLUMN land_area_verified TYPE NUMERIC USING NULL,
  ALTER COLUMN building_area_verified TYPE NUMERIC USING NULL;
