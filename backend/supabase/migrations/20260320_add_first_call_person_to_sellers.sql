-- マイグレーション: 1番電話フィールド追加
-- 作成日: 2026-03-20
-- 説明: sellersテーブルに1番電話（first_call_person）カラムを追加

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS first_call_person VARCHAR(255);

COMMENT ON COLUMN sellers.first_call_person IS '1番電話 - スプレッドシートDG列';
