-- 144: 訪問カレンダー確認済みフラグを sellers テーブルに追加
-- 通話モードページの「訪問カレンダー●OK」ボタンで手動設定する。
-- 訪問予定日前日（木曜訪問は水曜定休のため2日前）までにクリックされていない場合、
-- サイドバーの「訪問準備未」カテゴリーに表示するための判定に使用する。

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_calendar_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_calendar_confirmed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN sellers.visit_calendar_confirmed IS '訪問カレンダー確認済みフラグ（手動設定、訪問準備未サイドバー判定用）';
COMMENT ON COLUMN sellers.visit_calendar_confirmed_at IS '訪問カレンダー確認日時';
