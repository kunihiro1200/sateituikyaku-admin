-- Migration: 153_add_chat_send_fields_to_shared_items.sql
-- 共有リスト「他」選択時のチャット送信機能用フィールド追加
-- 作成日: 2026/09/08

-- チャット送信予定日時と実送信日時を追加
ALTER TABLE shared_items
ADD COLUMN IF NOT EXISTS scheduled_chat_datetime TIMESTAMPTZ,  -- チャット送信予定日時（NULL = 即時送信 or 未予約）
ADD COLUMN IF NOT EXISTS chat_sent_at TIMESTAMPTZ;            -- 実際にチャットを送信した日時（NULL = 未送信）

-- インデックス追加（予約送信の検索用）
CREATE INDEX IF NOT EXISTS idx_shared_items_scheduled_chat
ON shared_items (scheduled_chat_datetime)
WHERE scheduled_chat_datetime IS NOT NULL AND chat_sent_at IS NULL;

COMMENT ON COLUMN shared_items.scheduled_chat_datetime IS 'チャット送信予定日時（共有場が「他」の場合に使用）';
COMMENT ON COLUMN shared_items.chat_sent_at IS '実際にチャットを送信した日時';
