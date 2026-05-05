-- 緊急確認：買主番号が本当に消えているか確認

-- 1. 最新の買主10件を確認
SELECT 
  buyer_number,
  name,
  email,
  created_at
FROM buyers
WHERE is_deleted = false
ORDER BY created_at DESC
LIMIT 10;

-- 2. 買主番号がNULLのレコード数
SELECT COUNT(*) as null_buyer_number_count
FROM buyers
WHERE buyer_number IS NULL AND is_deleted = false;

-- 3. 買主番号が空文字のレコード数
SELECT COUNT(*) as empty_buyer_number_count
FROM buyers
WHERE buyer_number = '' AND is_deleted = false;

-- 4. 買主番号が正常なレコード数
SELECT COUNT(*) as valid_buyer_number_count
FROM buyers
WHERE buyer_number IS NOT NULL AND buyer_number != '' AND is_deleted = false;

-- 5. 全買主数
SELECT COUNT(*) as total_count
FROM buyers
WHERE is_deleted = false;
