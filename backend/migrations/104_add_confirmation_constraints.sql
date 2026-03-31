-- 物件リストの確認フィールドにデフォルト値とCHECK制約を追加

-- 既存物件の確認フィールドに初期値を設定
UPDATE property_listings
SET confirmation = '未'
WHERE confirmation IS NULL OR confirmation = '';

-- デフォルト値を設定
ALTER TABLE property_listings
ALTER COLUMN confirmation SET DEFAULT '未';

-- CHECK制約を追加（「未」または「済」のみ許可）
ALTER TABLE property_listings
ADD CONSTRAINT check_confirmation_value
CHECK (confirmation IN ('未', '済'));

-- 確認フィールドをNOT NULLに設定
ALTER TABLE property_listings
ALTER COLUMN confirmation SET NOT NULL;
