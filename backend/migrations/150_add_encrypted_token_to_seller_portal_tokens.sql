-- Migration: 150_add_encrypted_token_to_seller_portal_tokens
-- Description: 売却サポートページの専用URLを、スタッフ管理モーダルで常時表示できるようにする。
--   これまでは token_hash（SHA-256、一方向）のみを保存し、平文トークンは発行した瞬間しか
--   取得できなかった（パスワード保存と同じ考え方）。
--   運用上、モーダルを開き直すたびにURLを再確認したいという要望があったため、
--   既存の暗号化ユーティリティ（backend/src/utils/encryption.ts、AES-256-GCM。
--   氏名・電話番号等の暗号化と同じ方式）を使って可逆的に保存する token_encrypted 列を追加する。
--   token_hash は検証用に引き続き使用し、削除しない。
-- Created: 2026-09-04
-- 関連: backend/src/services/SellerPortalService.ts, backend/src/utils/encryption.ts

ALTER TABLE seller_portal_tokens ADD COLUMN IF NOT EXISTS token_encrypted TEXT;

COMMENT ON COLUMN seller_portal_tokens.token_encrypted IS
  '平文トークンをAES-256-GCMで暗号化した値（復号可能）。スタッフ管理画面でURLを常時表示するために保存する。token_hashは検証用として引き続き使用する';
