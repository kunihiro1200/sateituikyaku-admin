-- Migration: buyers.continue_distribution_after_contract カラム追加
-- 契約後（最新状況が「買」になった後）も物件情報配信を続けるかどうかのフラグ
-- NULL = 未選択（必須入力待ち）
-- TRUE = はい（近隣買主リストに表示する）
-- FALSE = いいえ（近隣買主リストから除外する）

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS continue_distribution_after_contract BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN buyers.continue_distribution_after_contract IS '契約後も物件情報配信継続フラグ（NULL=未選択, TRUE=はい, FALSE=いいえ）最新状況が「買（専任 両手）」「買（専任 片手）」「買（他社　片手）」になったときに必須入力';
