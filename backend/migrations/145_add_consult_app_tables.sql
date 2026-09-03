-- Migration: 145_add_consult_app_tables
-- Description: 不動産相談チャットアプリ（Consult App）用のテーブルを追加
--   - consult_sessions: 本人確認済みセッション（売主番号 or 電話番号で認証、端末に保存するトークン管理）
--   - consult_user_profile: 謄本読み取り結果・チャットで判明した事実の蓄積（同じ質問を繰り返さないための一次情報）
--   - consult_conversations: 会話（訪問1回分のセッション単位）
--   - consult_messages: 全メッセージログ（統計・未回答質問の管理を兼ねる）
-- Created: 2026-09-03
-- 関連: sellers テーブル（backend/src/services/SellerService.supabase.ts, 売主管理システム / ポート3000）

-- ============================================================
-- 1. consult_sessions: 本人確認済みセッション
-- ============================================================
CREATE TABLE IF NOT EXISTS consult_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,
  session_token VARCHAR(64) UNIQUE NOT NULL,      -- 端末のlocalStorageに保存させるトークン（推測困難な乱数）
  verified_by VARCHAR(20) NOT NULL,               -- 'seller_number' or 'phone_number'（本人確認に使った方法）
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,            -- 有効期限（NULL可、運用で決める）
  revoked_at TIMESTAMP WITH TIME ZONE,            -- 無効化した場合（不正利用対応など）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consult_sessions_seller_id ON consult_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_consult_sessions_seller_number ON consult_sessions(seller_number);
CREATE INDEX IF NOT EXISTS idx_consult_sessions_token ON consult_sessions(session_token);

COMMENT ON TABLE consult_sessions IS '相談アプリの本人確認済みセッション（端末保存トークンの管理）';
COMMENT ON COLUMN consult_sessions.session_token IS '端末のlocalStorageに保存させる推測困難なトークン。次回起動時はこれで自動ログイン';
COMMENT ON COLUMN consult_sessions.verified_by IS '本人確認に使った方法: seller_number または phone_number';

-- ============================================================
-- 2. consult_user_profile: 謄本読み取り結果・既知の事実の蓄積
-- ============================================================
CREATE TABLE IF NOT EXISTS consult_user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,

  -- 謄本読み取りから得た事実（sanitizeOwnerInfo相当の後処理を経た値を保存する）
  owner_name TEXT,
  owner_address TEXT,
  acquisition_date DATE,                 -- 取得日（所有期間の判定に使用）
  co_owners JSONB DEFAULT '[]',          -- 共有者情報
  has_mortgage BOOLEAN,                  -- 抵当権の有無
  toki_raw_extract JSONB,                -- 謄本OCRの生の抽出結果（デバッグ・再解析用に保持）
  toki_extracted_at TIMESTAMP WITH TIME ZONE,

  -- チャットの質疑応答から得た事実（テーマ横断で蓄積、都度カラムを増やさずJSONBで管理）
  -- 例: {"is_residing": {"value": true, "confirmed_at": "2026-08-15", "source": "chat"}}
  known_facts JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consult_user_profile_seller_number ON consult_user_profile(seller_number);

COMMENT ON TABLE consult_user_profile IS '相談アプリ：謄本読み取り結果とチャットで判明した既知の事実を蓄積し、同じ質問を繰り返さないための情報源';
COMMENT ON COLUMN consult_user_profile.known_facts IS 'テーマ横断で使う既知の事実。キーごとに value/confirmed_at/source を持つJSON';
COMMENT ON COLUMN consult_user_profile.toki_raw_extract IS '謄本OCRの生の抽出結果（TokiExtractService.sanitizeOwnerInfo適用後）。再解析・デバッグ用';

-- ============================================================
-- 3. consult_conversations: 会話セッション
-- ============================================================
CREATE TABLE IF NOT EXISTS consult_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_consult_conversations_seller_id ON consult_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_consult_conversations_seller_number ON consult_conversations(seller_number);

COMMENT ON TABLE consult_conversations IS '相談アプリの会話（訪問1回分のチャットセッション単位）';

-- ============================================================
-- 4. consult_messages: 全メッセージログ（統計・未回答管理を兼ねる）
-- ============================================================
CREATE TABLE IF NOT EXISTS consult_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES consult_conversations(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,     -- 直接検索・集計しやすくするための非正規化カラム
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  theme_tag VARCHAR(50),                  -- 例: 'juuto_3000man_kojo'（統計集計のキー）
  answer_source VARCHAR(20) CHECK (answer_source IN ('knowledge_base', 'llm_general', 'unanswered') OR answer_source IS NULL),
  llm_confidence VARCHAR(10) CHECK (llm_confidence IN ('high', 'low') OR llm_confidence IS NULL),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consult_messages_conversation_id ON consult_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_consult_messages_seller_number ON consult_messages(seller_number);
CREATE INDEX IF NOT EXISTS idx_consult_messages_theme_tag ON consult_messages(theme_tag);
CREATE INDEX IF NOT EXISTS idx_consult_messages_answer_source ON consult_messages(answer_source);
CREATE INDEX IF NOT EXISTS idx_consult_messages_created_at ON consult_messages(created_at);

COMMENT ON TABLE consult_messages IS '相談アプリの全メッセージログ。統計集計・未回答質問の管理（answer_source=unanswered）を兼ねる';
COMMENT ON COLUMN consult_messages.theme_tag IS '該当する制度テーマのタグ。統計集計のグルーピングキー';
COMMENT ON COLUMN consult_messages.answer_source IS 'knowledge_base=構造化データで回答, llm_general=LLM一般知識で回答, unanswered=回答できなかった（要ナレッジベース化）';

-- ============================================================
-- updated_at 自動更新トリガー（consult_user_profile）
-- ============================================================
CREATE OR REPLACE FUNCTION update_consult_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_consult_user_profile_updated_at ON consult_user_profile;
CREATE TRIGGER trigger_consult_user_profile_updated_at
  BEFORE UPDATE ON consult_user_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_consult_user_profile_updated_at();
