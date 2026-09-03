-- Migration: 146_add_seller_portal_tables
-- Description: 査定依頼者向け「売却サポートページ」機能のテーブルを追加
--   - seller_portal_tokens: 専用URLトークン（SHA-256ハッシュ化して保存、平文は保存しない）
--   - seller_portal_preferences: 売りたい価格/最低価格/希望売却時期、詳細手残り用の回答（known_facts）、閲覧状況
--   - seller_valuation_breakdowns: 査定額の内訳（土地・戸建のみ。今後の計算分から保存し、過去分は総額のみ表示する方針）
--   - seller_portal_conversations: 会話（相談元コンテキスト単位）
--   - seller_portal_messages: 売主⇄スタッフの全メッセージ（既読/未読管理を兼ねる）
-- Created: 2026-09-03
-- 関連: sellers テーブル（backend/src/services/SellerService.supabase.ts, 売主管理システム / ポート3000）
-- 注記: 前回作成した consult_sessions 等（145_add_consult_app_tables.sql）は方針変更のため
--       145_rollback_consult_app_tables.sql で削除済みの前提で本マイグレーションを実行すること。

-- ============================================================
-- 1. seller_portal_tokens: 専用URLトークン（ハッシュ化保存）
-- ============================================================
-- セキュリティ方針：氏名・住所・査定額・ローン情報・税務情報という機密性の高い情報を扱うため、
-- property_previews.slug や旧 consult_sessions.session_token（平文保存）より一段強い方式にする。
-- トークンの平文はURL発行時にのみ生成してユーザーに渡し、DBには SHA-256 ハッシュのみを保存する。
-- 検証時は受け取ったトークンをハッシュ化してこのテーブルと比較する（パスワード保存と同じ考え方）。
CREATE TABLE IF NOT EXISTS seller_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,   -- SHA-256ハッシュ（64文字16進）。平文トークンは保存しない
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,      -- NULL可（運用で決める。再発行の起点にもなる）
  revoked_at TIMESTAMP WITH TIME ZONE,      -- スタッフが無効化した場合
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_portal_tokens_seller_id ON seller_portal_tokens(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_portal_tokens_seller_number ON seller_portal_tokens(seller_number);
CREATE INDEX IF NOT EXISTS idx_seller_portal_tokens_hash ON seller_portal_tokens(token_hash);

COMMENT ON TABLE seller_portal_tokens IS '売却サポートページの専用URLトークン管理。token_hashはSHA-256、平文は保存しない';
COMMENT ON COLUMN seller_portal_tokens.token_hash IS 'SHA-256ハッシュ。検証時は受信トークンをハッシュ化して比較する';
COMMENT ON COLUMN seller_portal_tokens.access_count IS 'アクセスのたびに+1する。スタッフ管理画面の「アクセス回数」に対応';

-- ============================================================
-- 2. seller_portal_preferences: 希望条件・回答・閲覧状況
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_portal_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,

  -- 売却スケジュール（ユーザーが自由入力、初期値は査定額の最高/最低額）
  desired_sale_price BIGINT,              -- 「売りたい価格」（円）
  minimum_sale_price BIGINT,              -- 「最低の価格」（円）
  desired_settlement_year_month DATE,     -- 「いつまでに売りたいか」（年月、日は1で固定）

  -- 詳細手残り計算用の回答（ローン残高有無、購入時期、特別控除の可否等をキー・バリューで蓄積）
  -- 例: {"has_loan": {"value": true, "answeredAt": "2026-09-03"}, "loan_balance": {"value": 12000000, ...}}
  known_facts JSONB DEFAULT '{}',

  -- 行動データ（将来の売却検討度把握のために保存するが、現段階でスコア化はしない）
  viewed_rough_proceeds_at TIMESTAMP WITH TIME ZONE,
  viewed_detailed_proceeds_at TIMESTAMP WITH TIME ZONE,
  detailed_proceeds_completed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_portal_preferences_seller_number ON seller_portal_preferences(seller_number);

COMMENT ON TABLE seller_portal_preferences IS '売却サポートページ：ユーザー入力（希望価格・時期）、詳細手残りの回答、閲覧状況';
COMMENT ON COLUMN seller_portal_preferences.known_facts IS '詳細手残り計算用の回答をキー・バリューで蓄積（都度カラム追加しない設計）';

-- ============================================================
-- 3. seller_valuation_breakdowns: 査定額の内訳（土地・戸建のみ）
-- ============================================================
-- 方針：今後計算し直したタイミングでのみ内訳を保存する。過去に査定済みで内訳がない売主は、
-- 売却サポートページ側で総額のみ表示し、存在しない根拠を作らない（ユーザー指示に基づく）。
CREATE TABLE IF NOT EXISTS seller_valuation_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,

  land_area_used DECIMAL(10, 2),                      -- 計算時に使用した土地面積（㎡）
  fixed_asset_tax_road_price_used BIGINT,              -- 計算時に使用した固定資産税路線価（円/㎡）
  land_price BIGINT,                                   -- 算出した土地価格（円）

  building_area_used DECIMAL(10, 2),                   -- 計算時に使用した建物面積（㎡）
  building_age_used INTEGER,                           -- 計算時に使用した築年数
  structure_used VARCHAR(50),                          -- 計算時に使用した構造
  construction_unit_price_used BIGINT,                 -- 計算時に使用した建築単価（円/㎡）
  building_price BIGINT,                               -- 算出した建物価格（円）

  addition_amount_2 BIGINT,                            -- 査定額2（中間額）算出時の加算額（円）
  addition_amount_3 BIGINT,                            -- 査定額3（最高額）算出時の加算額（円）

  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_valuation_breakdowns_seller_number ON seller_valuation_breakdowns(seller_number);

COMMENT ON TABLE seller_valuation_breakdowns IS '査定額の内訳保存（土地・戸建のみ）。今後の計算分のみ保存し、過去分は総額のみ表示する運用';

-- ============================================================
-- 4. seller_portal_conversations: 会話（相談元コンテキスト単位）
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_portal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,
  context_tag VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (
    context_tag IN ('general', 'valuation', 'valuation_breakdown', 'net_proceeds', 'schedule')
  ),  -- どの機能から相談を開始したか（査定額/査定根拠/手残り/スケジュール/一般）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_portal_conversations_seller_id ON seller_portal_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_portal_conversations_seller_number ON seller_portal_conversations(seller_number);

COMMENT ON TABLE seller_portal_conversations IS '売却サポートページの相談スレッド。context_tagで相談元（査定額/手残り/スケジュール等）を記録';

-- ============================================================
-- 5. seller_portal_messages: 売主⇄スタッフの全メッセージ（既読/未読管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES seller_portal_conversations(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,          -- 直接検索・集計しやすくするための非正規化カラム
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('seller', 'staff')),
  sender_employee_id UUID REFERENCES employees(id),  -- sender_type='staff'の場合のみ設定
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,            -- 相手側が読んだ時刻（NULL=未読）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_portal_messages_conversation_id ON seller_portal_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_seller_portal_messages_seller_number ON seller_portal_messages(seller_number);
CREATE INDEX IF NOT EXISTS idx_seller_portal_messages_unread ON seller_portal_messages(seller_number, sender_type, read_at);

COMMENT ON TABLE seller_portal_messages IS '売却サポートページ：売主⇄スタッフのチャットメッセージ。read_atがNULLなら未読';
COMMENT ON COLUMN seller_portal_messages.sender_type IS 'seller=売主本人からの送信、staff=スタッフからの返信';

-- ============================================================
-- updated_at 自動更新トリガー（seller_portal_preferences）
-- ============================================================
CREATE OR REPLACE FUNCTION update_seller_portal_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seller_portal_preferences_updated_at ON seller_portal_preferences;
CREATE TRIGGER trigger_seller_portal_preferences_updated_at
  BEFORE UPDATE ON seller_portal_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_portal_preferences_updated_at();
