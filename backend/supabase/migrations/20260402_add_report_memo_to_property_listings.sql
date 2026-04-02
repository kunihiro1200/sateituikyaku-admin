-- マイグレーション: property_listingsテーブルにreport_memoカラムを追加
-- 日付: 2026-04-02
-- 目的: 物件リスト報告ページに「報告_メモ」フィールドを追加
-- 仕様: TEXT型、NULL許可、デフォルト値NULL、スプレッドシート同期対象外

-- report_memoカラムを追加
ALTER TABLE property_listings
ADD COLUMN IF NOT EXISTS report_memo TEXT;

-- カラムにコメントを追加
COMMENT ON COLUMN property_listings.report_memo IS '報告メモ（報告ページ専用、スプレッドシート同期対象外）';
