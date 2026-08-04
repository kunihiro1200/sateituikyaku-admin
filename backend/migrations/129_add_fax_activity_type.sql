-- ============================================================================
-- 129 activities テーブルの type 制約に 'fax' を追加
-- つうわモードページのFAX送信を履歴（activities）に記録できるようにする
-- ============================================================================

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;

ALTER TABLE activities ADD CONSTRAINT activities_type_check
CHECK (type IN ('phone_call', 'email', 'sms', 'fax', 'hearing', 'appointment'));

COMMENT ON CONSTRAINT activities_type_check ON activities IS '活動種別の制約（FAX送信履歴を追加）';

DO $$
BEGIN
  RAISE NOTICE '✅ 129: activities.type 制約に fax を追加しました';
END $$;
