-- ============================================================
-- HOME4U重複INSERT防止: phone_number_hash + inquiry_detailed_datetime UNIQUE制約
-- 同一電話番号 + 同一反響日時の組み合わせを DB レベルでアトミックにブロックする
-- ============================================================
-- 対象: sellersテーブル
-- 条件: phone_number_hash IS NOT NULL AND inquiry_detailed_datetime IS NOT NULL
--       かつ deleted_at IS NULL（論理削除レコードは除外）
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_unique_phone_datetime
  ON sellers (phone_number_hash, inquiry_detailed_datetime)
  WHERE phone_number_hash IS NOT NULL
    AND inquiry_detailed_datetime IS NOT NULL
    AND deleted_at IS NULL;

-- 確認クエリ（適用後に実行して確認）
-- SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_sellers_unique_phone_datetime';
