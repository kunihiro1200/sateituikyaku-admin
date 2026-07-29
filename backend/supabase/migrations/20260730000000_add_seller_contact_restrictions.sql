-- 通話モードで連絡手段ごとのNG状態を保存する
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS email_send_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_send_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_call_disabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN sellers.email_send_disabled IS 'Email送信不可フラグ';
COMMENT ON COLUMN sellers.sms_send_disabled IS 'SMS送信不可フラグ';
COMMENT ON COLUMN sellers.phone_call_disabled IS '電話使用不可フラグ';
