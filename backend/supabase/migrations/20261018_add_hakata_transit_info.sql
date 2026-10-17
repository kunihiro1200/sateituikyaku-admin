-- Migration 20261018: seller_transit_access に博多駅への交通情報カラムを追加
-- FI売主（福岡）の駅について、博多駅への所要時間・乗り換え情報を保存する

ALTER TABLE seller_transit_access
  ADD COLUMN IF NOT EXISTS transit_to_hakata_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS transit_to_hakata_text    TEXT;

COMMENT ON COLUMN seller_transit_access.transit_to_hakata_minutes IS
  '博多駅までの電車所要時間（分）。FI売主の駅のみ設定。';
COMMENT ON COLUMN seller_transit_access.transit_to_hakata_text IS
  '博多駅への経路テキスト。例: 七隈線直通 博多まで10分 / 西鉄→天神で地下鉄空港線乗換→博多まで25分';
