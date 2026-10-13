-- =====================================================================
-- construction_unit_price_history テーブル
-- construction_unit_prices の price_per_sqm 変更履歴を保持する
--
-- 変更のたびにこのテーブルに記録する。
-- 「変更前の単価・変更後の単価・出典・変更理由・変更日時」が残ることで、
-- いつ・何を・なぜ変更したかを追跡できる。
-- =====================================================================

CREATE TABLE IF NOT EXISTS construction_unit_price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 変更対象
  construction_unit_price_id uuid NOT NULL REFERENCES construction_unit_prices(id),
  year      integer NOT NULL,
  structure text    NOT NULL,

  -- 変更内容
  old_price integer NOT NULL,   -- 変更前 price_per_sqm
  new_price integer NOT NULL,   -- 変更後 price_per_sqm
  change    integer GENERATED ALWAYS AS (new_price - old_price) STORED,

  -- 出典・理由
  source     text NOT NULL,     -- 'nta' / 'estat' / 'custom' / 'manual'
  reason     text NOT NULL,     -- 変更理由
  applied_by text NOT NULL DEFAULT 'admin', -- 適用者

  -- タイムスタンプ
  applied_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_construction_price_history_year
  ON construction_unit_price_history (year, structure);

CREATE INDEX IF NOT EXISTS idx_construction_price_history_target
  ON construction_unit_price_history (construction_unit_price_id);

COMMENT ON TABLE construction_unit_price_history IS
  'construction_unit_prices の price_per_sqm 変更履歴。査定額に影響する変更は必ずここに記録される。';
