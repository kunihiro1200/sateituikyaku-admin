-- Migration: activity_logs.employee_id を nullable に変更
-- Reason: SMS送信など、employee_id が取得できない場合でも記録できるようにする

ALTER TABLE activity_logs
  ALTER COLUMN employee_id DROP NOT NULL;
