-- Migration 103: activity_logs.target_id を UUID から TEXT に変更
-- 買主番号（例: "4370"）はUUID形式ではないため、TEXT型に変更する

ALTER TABLE activity_logs ALTER COLUMN target_id TYPE TEXT;
