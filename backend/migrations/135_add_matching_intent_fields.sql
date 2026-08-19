-- Migration 135: 売主・買主マッチング機能用の構造化フィールドを追加
-- 目的: 「売主が舞鶴町の物件をすぐ売りたい」「買主が舞鶴町で1年以内に探している」のような
--       意図をAIのフリーテキスト解析に依存せず、構造化入力（種別/エリア/時期/金額）で保存し、
--       決定論的なルールでクロスマッチングできるようにする。

-- ============================================
-- sellers テーブル
-- ============================================
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_intent_type TEXT DEFAULT 'sell';
-- 'sell' | 'buy' | 'both'（通常は売却だが、将来買い替え等で購入希望も持つ場合に対応）

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_areas JSONB DEFAULT '[]'::jsonb;
-- 既存のエリアコード配列（丸数字①〜⑮㊵㊶㊷㊸、英字コードF1〜F10等）。
-- 通常は物件住所から自動算出するが、担当者が手動で追加・上書きできる。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_area_free_text TEXT;
-- 既存エリアマッピングに存在しない地名（例: 「舞鶴町」）を自由入力するための欄。
-- マッチング時は相手側の住所・自由入力に対する部分一致で判定する（AI解析は行わない）。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_timing TEXT;
-- 固定enum: '今すぐ' | '3ヶ月以内' | '半年以内' | '1年以内' | '1年以上・様子見'

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_price_min BIGINT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_price_max BIGINT;
-- 円単位。売主の場合は「売却希望価格帯」。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_memo TEXT;
-- 補足の自由記述（マッチング判定には使わない。人が読むための備考欄）。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN sellers.match_intent_type IS 'マッチング機能: 意図の種別（sell/buy/both）';
COMMENT ON COLUMN sellers.match_areas IS 'マッチング機能: 希望/対象エリアコード配列（JSONB）';
COMMENT ON COLUMN sellers.match_area_free_text IS 'マッチング機能: エリアマッピング外の自由入力地名';
COMMENT ON COLUMN sellers.match_timing IS 'マッチング機能: 時期（固定選択肢）';
COMMENT ON COLUMN sellers.match_price_min IS 'マッチング機能: 金額下限（円）';
COMMENT ON COLUMN sellers.match_price_max IS 'マッチング機能: 金額上限（円）';
COMMENT ON COLUMN sellers.match_memo IS 'マッチング機能: 補足メモ（判定には使用しない）';
COMMENT ON COLUMN sellers.match_updated_at IS 'マッチング機能: 入力欄の最終更新日時';

CREATE INDEX IF NOT EXISTS idx_sellers_match_areas ON sellers USING GIN (match_areas);
CREATE INDEX IF NOT EXISTS idx_sellers_match_timing ON sellers(match_timing);

-- ============================================
-- buyers テーブル
-- ============================================
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_intent_type TEXT DEFAULT 'buy';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_areas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_area_free_text TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_timing TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_price_min BIGINT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_price_max BIGINT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_memo TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN buyers.match_intent_type IS 'マッチング機能: 意図の種別（sell/buy/both）';
COMMENT ON COLUMN buyers.match_areas IS 'マッチング機能: 希望/対象エリアコード配列（JSONB）';
COMMENT ON COLUMN buyers.match_area_free_text IS 'マッチング機能: エリアマッピング外の自由入力地名';
COMMENT ON COLUMN buyers.match_timing IS 'マッチング機能: 時期（固定選択肢）';
COMMENT ON COLUMN buyers.match_price_min IS 'マッチング機能: 金額下限（円）';
COMMENT ON COLUMN buyers.match_price_max IS 'マッチング機能: 金額上限（円）';
COMMENT ON COLUMN buyers.match_memo IS 'マッチング機能: 補足メモ（判定には使用しない）';
COMMENT ON COLUMN buyers.match_updated_at IS 'マッチング機能: 入力欄の最終更新日時';

CREATE INDEX IF NOT EXISTS idx_buyers_match_areas ON buyers USING GIN (match_areas);
CREATE INDEX IF NOT EXISTS idx_buyers_match_timing ON buyers(match_timing);
