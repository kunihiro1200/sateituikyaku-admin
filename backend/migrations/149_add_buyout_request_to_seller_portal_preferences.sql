-- Migration: 149_add_buyout_request_to_seller_portal_preferences
-- Description: 売却スケジュールが過去日に圧縮される（3ヶ月以内での売却を要する）場合に表示する
--   「買取依頼」ボタンの状態を保存するカラムを追加する。
--   スタッフ確認済みフラグも合わせて持ち、既存の「売却サポート：対応要」サイドバーカテゴリーの
--   対象条件に含める（staff_confirmed_settlement_atと同じ考え方）。
-- Created: 2026-09-03

ALTER TABLE seller_portal_preferences ADD COLUMN IF NOT EXISTS buyout_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE seller_portal_preferences ADD COLUMN IF NOT EXISTS staff_confirmed_buyout_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN seller_portal_preferences.buyout_requested_at IS
  '売主が「買取依頼」ボタンを押した日時。NULLなら未依頼';
COMMENT ON COLUMN seller_portal_preferences.staff_confirmed_buyout_at IS
  'スタッフが買取依頼を確認した日時。NULLなら未確認（サイドバーカテゴリーの対象）';
