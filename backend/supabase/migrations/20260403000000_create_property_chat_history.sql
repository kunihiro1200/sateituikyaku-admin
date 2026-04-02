-- Create property_chat_history table for storing CHAT message history
CREATE TABLE IF NOT EXISTS property_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_number VARCHAR(50) NOT NULL,
  chat_type VARCHAR(20) NOT NULL CHECK (chat_type IN ('office', 'assignee')),
  message TEXT NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT fk_property_chat_history_property_number 
    FOREIGN KEY (property_number) 
    REFERENCES property_listings(property_number) 
    ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_property_chat_history_property_number 
  ON property_chat_history(property_number);

CREATE INDEX IF NOT EXISTS idx_property_chat_history_sent_at 
  ON property_chat_history(sent_at DESC);

-- Add comment to table
COMMENT ON TABLE property_chat_history IS 'CHAT送信履歴テーブル - 物件リスト詳細画面の「事務へCHAT」「担当へCHAT」の送信履歴を保存';

-- Add comments to columns
COMMENT ON COLUMN property_chat_history.id IS '履歴レコードの一意識別子';
COMMENT ON COLUMN property_chat_history.property_number IS '物件番号（property_listingsテーブルへの外部キー）';
COMMENT ON COLUMN property_chat_history.chat_type IS '送信先タイプ（office=事務、assignee=担当）';
COMMENT ON COLUMN property_chat_history.message IS '送信したメッセージ内容';
COMMENT ON COLUMN property_chat_history.sender_name IS '送信者名';
COMMENT ON COLUMN property_chat_history.sent_at IS '送信日時';
COMMENT ON COLUMN property_chat_history.created_at IS 'レコード作成日時';
