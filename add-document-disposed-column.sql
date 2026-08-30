-- 物件資料処分済カラムを追加（ATBB状況が「非公開」の場合に「済」「未」を記録）
--
-- ⚠️ 本番DB（Supabase）に未適用だったため、物件詳細ページの保存で
--    "Could not find the 'document_disposed' column" エラー（500）が発生していた。
--    Supabase ダッシュボードの SQL Editor で以下を実行して適用すること。
ALTER TABLE property_listings ADD COLUMN IF NOT EXISTS document_disposed TEXT;

COMMENT ON COLUMN property_listings.document_disposed IS '物件資料処分済（「済」/「未」）。ATBB状況が非公開のときに使用';
