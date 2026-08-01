-- confirmation = '済' なのに sidebar_status = '未完了' のままの物件を修正
UPDATE property_listings
SET sidebar_status = NULL, updated_at = NOW()
WHERE confirmation = '済' AND sidebar_status = '未完了';
