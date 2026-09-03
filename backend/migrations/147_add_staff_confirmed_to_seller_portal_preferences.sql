-- Migration: 147_add_staff_confirmed_to_seller_portal_preferences
-- Description: 売却サポートページのサイドバーカテゴリー「売却サポート：対応が必要」のために、
--   「いつまでに売りたいか」入力をスタッフが確認済みかどうかのフラグを追加する。
--   Google Chat通知の代わりに、サイドバーのカテゴリー表示で気づける仕組みに変更したため。
-- Created: 2026-09-03

ALTER TABLE seller_portal_preferences ADD COLUMN IF NOT EXISTS staff_confirmed_settlement_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN seller_portal_preferences.staff_confirmed_settlement_at IS
  'スタッフが「いつまでに売りたいか」の入力を確認した日時。NULLなら未確認（サイドバーカテゴリーの対象）';
