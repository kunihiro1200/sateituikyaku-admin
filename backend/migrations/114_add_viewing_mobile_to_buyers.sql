-- ============================================================
-- マイグレーション: 114_add_viewing_mobile_to_buyers.sql
-- 目的: buyers テーブルに viewing_mobile カラムを追加する
-- 作成日: 2026年
-- 関連スペック: viewing-type-sync-fix
-- 背景:
--   GASの BUYER_COLUMN_MAPPING で '内覧形態' が 'viewing_mobile' にマッピングされているが、
--   buyers テーブルに viewing_mobile カラムが存在しなかったため、
--   スプレッドシートの「内覧形態」列の値がDBに反映されないバグが発生していた。
-- ============================================================

-- viewing_mobile カラムを追加（既に存在する場合はスキップ）
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_mobile TEXT;

-- コメントを追加
COMMENT ON COLUMN buyers.viewing_mobile IS '内覧形態（例: 【内覧_専（自社物件）】）。GASのBUYER_COLUMN_MAPPINGで「内覧形態」にマッピングされる。';

-- 既存の viewing_type カラムのデータを viewing_mobile にコピー
-- （viewing_type に既にデータが入っている場合の移行処理）
UPDATE buyers
SET viewing_mobile = viewing_type
WHERE viewing_type IS NOT NULL
  AND viewing_type <> ''
  AND (viewing_mobile IS NULL OR viewing_mobile = '');

-- 実行確認用クエリ（コメントアウト済み）
-- SELECT COUNT(*) FROM buyers WHERE viewing_mobile IS NOT NULL;
-- SELECT buyer_number, viewing_type, viewing_mobile FROM buyers WHERE viewing_type IS NOT NULL LIMIT 10;
