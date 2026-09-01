-- 重複による除外確認フラグを追加
--
-- ⚠️ 既存の duplicate_confirmed とは意味が違うので混同しないこと
--   duplicate_confirmed            : 転記時に「これは重複案件だ」と判定された印（自動）
--   duplicate_exclusion_checked    : 担当者が「重複による除外を確認した」印（手動）← 本カラム

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS duplicate_exclusion_checked BOOLEAN DEFAULT false;

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS duplicate_exclusion_checked_at TIMESTAMPTZ;

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS duplicate_exclusion_checked_by TEXT;

COMMENT ON COLUMN sellers.duplicate_exclusion_checked IS '重複による除外確認が済んでいるか（通話モードの済/未ボタン）';
COMMENT ON COLUMN sellers.duplicate_exclusion_checked_at IS '重複による除外確認を行った日時';
COMMENT ON COLUMN sellers.duplicate_exclusion_checked_by IS '重複による除外確認を行った担当者';
