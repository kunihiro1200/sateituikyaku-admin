-- Migration: 契約後司法書士メール・金種表連絡メールフィールドの追加
-- 業務詳細画面「売主・買主詳細」タブ用の新規フィールド（DB専用、スプシ非同期）

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS judicial_scrivener_email_after_contract TEXT,
  ADD COLUMN IF NOT EXISTS settlement_seller_denomination_email TEXT,
  ADD COLUMN IF NOT EXISTS settlement_buyer_denomination_email TEXT;

COMMENT ON COLUMN work_tasks.judicial_scrivener_email_after_contract IS '契約後　司法書士へのメール（済/不要）- DB専用';
COMMENT ON COLUMN work_tasks.settlement_seller_denomination_email IS '決済前、売主金種表連絡メール（済/不要）- DB専用';
COMMENT ON COLUMN work_tasks.settlement_buyer_denomination_email IS '決済前、買主金種表連絡メール（済/不要）- DB専用';
