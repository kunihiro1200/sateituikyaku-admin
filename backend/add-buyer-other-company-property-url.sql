-- Migration: 買主の他社物件サイトURLフィールドの追加
-- 買主リスト通話モードページ（BuyerDetailPage）の「他社物件情報」セクションで
-- 他社サイト（athome / SUUMO 等）のURLを入力・保存するための項目
-- DB専用（スプレッドシート非同期）

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS other_company_property_url TEXT;

COMMENT ON COLUMN buyers.other_company_property_url IS '他社物件のサイトURL（athome/SUUMO等）- 買主詳細の他社物件情報セクション用 - DB専用';
