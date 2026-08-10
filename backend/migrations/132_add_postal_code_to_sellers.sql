-- ============================================================================
-- 132 sellers テーブルに郵便番号カラムを追加
-- ============================================================================

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10); -- 売主郵便番号（例: 123-4567）

COMMENT ON COLUMN sellers.postal_code IS '売主郵便番号（例: 123-4567）';

DO $$
BEGIN
  RAISE NOTICE '✅ sellers.postal_code カラムを追加しました';
END $$;
