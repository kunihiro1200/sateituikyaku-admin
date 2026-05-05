-- 全買主の買主番号を確認
SELECT 
  buyer_id,
  buyer_number,
  name,
  created_at,
  updated_at
FROM buyers
WHERE is_deleted = false
ORDER BY created_at DESC
LIMIT 20;

-- 買主番号がNULLまたは空のレコードを確認
SELECT COUNT(*) as null_count
FROM buyers
WHERE (buyer_number IS NULL OR buyer_number = '') AND is_deleted = false;

-- 買主番号が正常なレコードを確認
SELECT COUNT(*) as valid_count
FROM buyers
WHERE buyer_number IS NOT NULL AND buyer_number != '' AND is_deleted = false;
