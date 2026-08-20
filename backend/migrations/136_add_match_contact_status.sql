-- Migration 136: マッチング機能の「連絡状況」フィールドを追加
-- 目的: サイドバーのマッチング通知に対して「連絡済み/連絡不要/連絡未」を記録し、
--       連絡済み・連絡不要にした場合はサイドバーのカウントから除外する。
--       記録自体はつうわモードページ・買主詳細ページで常時確認できるようにする。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS match_contact_status TEXT;
-- '連絡済み' | '連絡不要' | '連絡未' | null（未対応）

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS match_contact_status TEXT;

COMMENT ON COLUMN sellers.match_contact_status IS 'マッチング機能: 買主候補への連絡状況（連絡済み/連絡不要/連絡未）。連絡済み・連絡不要はサイドバーのマッチング通知から除外される';
COMMENT ON COLUMN buyers.match_contact_status IS 'マッチング機能: 売主/物件候補への連絡状況（連絡済み/連絡不要/連絡未）。連絡済み・連絡不要はサイドバーのマッチング通知から除外される';

CREATE INDEX IF NOT EXISTS idx_sellers_match_contact_status ON sellers(match_contact_status);
CREATE INDEX IF NOT EXISTS idx_buyers_match_contact_status ON buyers(match_contact_status);
