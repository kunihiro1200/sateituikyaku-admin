-- Migration: 売買契約確認フィールドの追加
-- 「売主、買主詳細」タブ用の新規フィールド
-- sales_contract_confirmed は既存カラム（スプシAM列と同期済み）

-- 契約書・重説修正あり/なし（DB専用、スプシ非同期）
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS contract_revision_exists TEXT,
  ADD COLUMN IF NOT EXISTS contract_revision_content TEXT;

COMMENT ON COLUMN work_tasks.contract_revision_exists IS '契約書、重説他　修正点（あり/なし）- DB専用';
COMMENT ON COLUMN work_tasks.contract_revision_content IS '契約書、重説他の修正内容 - DB専用';
