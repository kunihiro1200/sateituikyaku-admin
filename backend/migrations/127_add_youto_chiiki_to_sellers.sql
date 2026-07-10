-- ============================================================================
-- 127 sellersテーブルに用途地域カラムを追加
-- 不動産情報ライブラリAPIから取得した用途地域・区域区分を保存する
-- ============================================================================

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS youto_chiiki TEXT;

COMMENT ON COLUMN sellers.youto_chiiki IS '用途地域・区域区分（例: 第一種住居地域、市街化調整区域）';

DO $$
BEGIN
  RAISE NOTICE '✅ 127: youto_chiikiカラムをsellersテーブルに追加しました';
END $$;
