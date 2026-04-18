-- sellers テーブルに first_call_initials カラムを追加するマイグレーション
-- 用途: 売主リストスプレッドシートのY列「一番TEL」（最初に電話した担当者のイニシャル）を格納する
-- 実行タイミング: syncFirstTelToDb GASスクリプトを実行する前に適用すること

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_call_initials VARCHAR(10);
