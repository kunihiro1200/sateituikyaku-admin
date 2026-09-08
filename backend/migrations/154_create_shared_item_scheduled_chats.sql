-- Migration: 154_create_shared_item_scheduled_chats.sql
-- スプレッドシート由来の共有アイテム用チャット予約テーブル
-- 作成日: 2026/09/08
-- 理由: shared_itemsはスプレッドシート管理でIDが数値文字列のため、
--       Supabase側で予約情報を保存する専用テーブルが必要

-- チャット予約情報テーブル
CREATE TABLE IF NOT EXISTS shared_item_scheduled_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_item_id TEXT NOT NULL,  -- スプレッドシートの行番号（例: "305"）
  scheduled_datetime TIMESTAMPTZ NOT NULL,  -- チャット送信予定日時
  chat_sent_at TIMESTAMPTZ,  -- 実際に送信した日時（NULL = 未送信）
  include_warning_text BOOLEAN DEFAULT true,  -- 注意文を含めるか
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス: スプレッドシートIDで検索
CREATE INDEX IF NOT EXISTS idx_scheduled_chats_spreadsheet_id
ON shared_item_scheduled_chats (spreadsheet_item_id);

-- インデックス: 未送信の予約送信を検索（cron用）
-- 注: now()は使用せず、部分インデックスでchat_sent_atがNULLのもののみをインデックス化
CREATE INDEX IF NOT EXISTS idx_scheduled_chats_pending
ON shared_item_scheduled_chats (scheduled_datetime)
WHERE chat_sent_at IS NULL;

COMMENT ON TABLE shared_item_scheduled_chats IS 'スプレッドシート管理の共有アイテムのチャット予約情報';
COMMENT ON COLUMN shared_item_scheduled_chats.spreadsheet_item_id IS 'スプレッドシートの行番号（IDとして使用）';
COMMENT ON COLUMN shared_item_scheduled_chats.scheduled_datetime IS 'チャット送信予定日時';
COMMENT ON COLUMN shared_item_scheduled_chats.chat_sent_at IS '実際に送信した日時（NULL = 未送信）';
COMMENT ON COLUMN shared_item_scheduled_chats.include_warning_text IS '注意文「共有できていないスタッフ〜」を含めるか';
