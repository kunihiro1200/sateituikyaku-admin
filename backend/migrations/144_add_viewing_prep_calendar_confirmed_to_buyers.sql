-- Migration 144: 買主テーブルに内覧準備カレンダー確認フラグを追加
-- 「カレンダー●OK」ボタン（買主詳細ページヘッダー、内覧準備ボタンの左隣）の確認状態を記録する
-- 用途: 内覧日前日（木曜内覧は2日前）までにこのボタンが押されていない場合、
--       買主一覧サイドバーに「内覧準備資料未」カテゴリとして表示する

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS viewing_prep_calendar_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN buyers.viewing_prep_calendar_confirmed_at IS
  '内覧準備の「カレンダー●OK」ボタンを押した日時。NULLは未確認（内覧準備資料未の判定に使用）。';

CREATE INDEX IF NOT EXISTS idx_buyers_viewing_prep_calendar_confirmed_at
  ON buyers(viewing_prep_calendar_confirmed_at);
