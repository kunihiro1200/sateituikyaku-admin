-- Fix VARCHAR(100) limits for long text fields and add visit_time column
-- AA13846のデータ長エラーを修正し、訪問時間カラムを追加

-- 1. 間取り（floor_plan）をTEXT型に変更（256文字のデータあり）
ALTER TABLE sellers ALTER COLUMN floor_plan TYPE TEXT;
COMMENT ON COLUMN sellers.floor_plan IS '間取り（TEXT型、長文対応）';

-- 2. コメント（comments）をTEXT型に変更（273文字のデータあり）
ALTER TABLE sellers ALTER COLUMN comments TYPE TEXT;
COMMENT ON COLUMN sellers.comments IS 'コメント（TEXT型、長文対応）';

-- 3. キャンセル案内担当（cancel_notice_assignee）をTEXT型に変更（293文字のデータあり）
ALTER TABLE sellers ALTER COLUMN cancel_notice_assignee TYPE TEXT;
COMMENT ON COLUMN sellers.cancel_notice_assignee IS 'キャンセル案内担当（TEXT型、長文対応）';

-- 4. 訪問時間（visit_time）カラムを追加
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_time VARCHAR(20);
COMMENT ON COLUMN sellers.visit_time IS '訪問時間（例: 10:00、14:30）';

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ マイグレーション完了:';
  RAISE NOTICE '   - floor_plan: VARCHAR(100) → TEXT';
  RAISE NOTICE '   - comments: VARCHAR(100) → TEXT';
  RAISE NOTICE '   - cancel_notice_assignee: VARCHAR(100) → TEXT';
  RAISE NOTICE '   - visit_time: 追加（VARCHAR(20)）';
END $$;
