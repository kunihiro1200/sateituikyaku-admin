-- NaNの買主番号を持つレコードを削除
DELETE FROM buyers
WHERE buyer_number = 'NaN';

-- 確認
SELECT buyer_id, buyer_number, name, created_at
FROM buyers
WHERE buyer_number = 'NaN' OR buyer_number IS NULL OR buyer_number = '';
