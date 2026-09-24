-- SUUMO登録・公開お知らせメール配信の済/未カラムを追加
--
-- ⚠️ 本番DB（Supabase）に未適用だと、物件詳細（レインズ登録）ページの保存で
--    "Could not find the 'suumo_registration_done' / 'publish_notice_email' column"
--    エラー（500）が発生する。
--    Supabase ダッシュボードの SQL Editor で以下を実行して適用すること。
--
-- 対象: ATBB状況が「一般・公開中」かつ AA14824以降の物件（2026-09-24 判定開始）

ALTER TABLE property_listings ADD COLUMN IF NOT EXISTS suumo_registration_done TEXT;
ALTER TABLE property_listings ADD COLUMN IF NOT EXISTS publish_notice_email TEXT;

COMMENT ON COLUMN property_listings.suumo_registration_done IS 'SUUMO登録（「済」/「未」）。ATBB状況が一般・公開中（AA14824以降）のときに使用';
COMMENT ON COLUMN property_listings.publish_notice_email IS '公開お知らせメール配信（「済」/「未」）。ATBB状況が一般・公開中（AA14824以降）のときに使用';
