-- Migration 138: 売主の「買いたい」マッチング機能用の構造化フィールドを追加
--
-- 背景:
--   売主は基本的に「売りたい」立場だが、買い替え等で同時に「買いたい」意図を
--   持つ場合がある（sellers.match_intent_type に 'sell'|'buy'|'both' の想定が
--   既に存在していたが、実装では未使用だった）。
--   既存の match_* フィールドは「売却条件」専用として運用されているため、
--   「購入条件」は別カラム（buy_match_*）として独立させ、双方を同時に持てるようにする。
--
-- マッチング相手:
--   売主の「買いたい」意図は、他の売主の「売りたい」条件（match_*）と比較する。
--   買主の「希望条件」（desired_area等）とは比較しない
--   （買主は最初から「買いたい」側なので、売主の売却条件と比較する既存ロジックで十分）。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_areas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_area_free_text TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_timing TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_price_min BIGINT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_price_max BIGINT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_memo TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS buy_match_contact_status TEXT;
-- buy_match_contact_status は現状未使用（ペア単位の連絡状況は seller_seller_match_contacts で管理する）。
-- 将来単一フラグが必要になった場合に備えて他の match_contact_status と対称に用意しておく。

COMMENT ON COLUMN sellers.buy_match_areas IS 'マッチング機能（購入側）: 希望エリアコード配列（JSONB）';
COMMENT ON COLUMN sellers.buy_match_area_free_text IS 'マッチング機能（購入側）: エリアマッピング外の自由入力地名';
COMMENT ON COLUMN sellers.buy_match_timing IS 'マッチング機能（購入側）: 時期（固定選択肢）';
COMMENT ON COLUMN sellers.buy_match_price_min IS 'マッチング機能（購入側）: 金額下限（円）';
COMMENT ON COLUMN sellers.buy_match_price_max IS 'マッチング機能（購入側）: 金額上限（円）';
COMMENT ON COLUMN sellers.buy_match_memo IS 'マッチング機能（購入側）: 補足メモ（判定には使用しない）';
COMMENT ON COLUMN sellers.buy_match_updated_at IS 'マッチング機能（購入側）: 入力欄の最終更新日時';
COMMENT ON COLUMN sellers.buy_match_contact_status IS 'マッチング機能（購入側）: 単一フラグ用（現状未使用、ペア単位はseller_seller_match_contactsで管理）';

CREATE INDEX IF NOT EXISTS idx_sellers_buy_match_areas ON sellers USING GIN (buy_match_areas);
CREATE INDEX IF NOT EXISTS idx_sellers_buy_match_timing ON sellers(buy_match_timing);
