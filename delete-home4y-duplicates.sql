-- ======================================================
-- HOME4Y重複レコード削除SQL
-- FI309を残して、同一電話番号の重複を論理削除する
-- ======================================================
--
-- 【実行手順】
-- 1. Supabase → SQL Editor を開く
-- 2. ステップ1のSELECTを実行してFI309の情報を確認
-- 3. ステップ2のSELECTで重複レコードを確認
-- 4. 内容が正しければステップ3のUPDATEを実行
-- 5. ステップ4で削除されたことを確認
--
-- ======================================================

-- ステップ1: FI309の情報を確認
SELECT
  seller_number,
  id,
  phone_number_hash,
  inquiry_date,
  inquiry_site,
  created_at
FROM sellers
WHERE seller_number = 'FI309'
  AND deleted_at IS NULL;

-- ======================================================
-- ステップ2: FI309と同じphone_number_hashを持つ全レコードを確認
-- （これが削除対象の重複リスト）
-- ======================================================
SELECT
  seller_number,
  id,
  phone_number_hash,
  inquiry_date,
  inquiry_site,
  created_at,
  deleted_at
FROM sellers
WHERE phone_number_hash IS NOT NULL
  AND phone_number_hash = (
    SELECT phone_number_hash
    FROM sellers
    WHERE seller_number = 'FI309'
      AND deleted_at IS NULL
      AND phone_number_hash IS NOT NULL
    LIMIT 1
  )
ORDER BY created_at;

-- ======================================================
-- ステップ3: FI309以外を論理削除（deleted_atをセット）
-- ※ 必ずステップ2のSELECTで確認してから実行すること！
-- ======================================================
UPDATE sellers
SET
  deleted_at = NOW(),
  updated_at = NOW()
WHERE phone_number_hash IS NOT NULL
  AND phone_number_hash = (
    SELECT phone_number_hash
    FROM sellers
    WHERE seller_number = 'FI309'
      AND deleted_at IS NULL
      AND phone_number_hash IS NOT NULL
    LIMIT 1
  )
  AND seller_number != 'FI309'
  AND deleted_at IS NULL;

-- ======================================================
-- ステップ4: 削除結果を確認（FI309のみ残っていることを確認）
-- ======================================================
SELECT
  seller_number,
  id,
  deleted_at,
  created_at
FROM sellers
WHERE phone_number_hash IS NOT NULL
  AND phone_number_hash = (
    SELECT phone_number_hash
    FROM sellers
    WHERE seller_number = 'FI309'
    LIMIT 1
  )
ORDER BY created_at;
