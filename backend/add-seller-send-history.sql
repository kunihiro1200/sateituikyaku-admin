-- 売主への送信履歴機能のマイグレーション
-- property_chat_history テーブルに subject カラムを追加し、
-- chat_type の CHECK 制約を拡張する

-- 1. subject カラムを追加（件名: EMAIL/GMAIL はメール件名、SMS は空文字）
ALTER TABLE property_chat_history
  ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT '';

COMMENT ON COLUMN property_chat_history.subject IS '送信履歴の件名（EMAIL/GMAIL: メール件名、SMS: 空文字）';

-- 2. 既存の chat_type CHECK 制約を削除して再作成
--    seller_email / seller_sms / seller_gmail を追加
ALTER TABLE property_chat_history
  DROP CONSTRAINT IF EXISTS property_chat_history_chat_type_check;

ALTER TABLE property_chat_history
  ADD CONSTRAINT property_chat_history_chat_type_check
    CHECK (chat_type IN ('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail'));

-- 3. chat_type カラムへのインデックスを追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_property_chat_history_chat_type
  ON property_chat_history(chat_type);
