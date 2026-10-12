-- =====================================================================
-- construction_unit_prices テーブル
-- 建築年別・構造別の建築単価を一元管理
--
-- 目的:
--   「1965〜2025年はハードコード、2026年以降はDB参照」という構成を廃止し
--   全年度の建築単価をDBで管理する。
--   国税庁・国交省e-Stat・独自係数など複数ソースを区別して保持し、
--   どの単価を査定計算に使用するかを明示的に管理する。
--
-- 設計方針:
--   - price_per_sqm が査定計算に使用される実値
--   - nta_price  : 国税庁「建物の標準的な建築価額表」公表値
--   - estat_price: 国交省 e-Stat API（建築着工統計）から算出した値
--   - custom_price: 手動設定値・補正値
--   - is_approved: true のものが本番査定に使用される
--   - is_provisional: true = 正式データ未取得の暫定値
-- =====================================================================

CREATE TABLE IF NOT EXISTS construction_unit_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 主キー要素
  year integer NOT NULL CHECK (year >= 1959 AND year <= 2100),
  structure text NOT NULL,
  -- '木造' | '軽量鉄骨' | '鉄骨' | '鉄筋コンクリート' | '鉄骨鉄筋コンクリート'

  -- 査定計算に使用する単価（円/㎡）
  -- この列の値が ValuationCalculatorService で参照される
  price_per_sqm integer NOT NULL CHECK (price_per_sqm > 0),

  -- 各ソースの単価（NULL = 未取得）
  nta_price   integer,   -- 国税庁「建物の標準的な建築価額表」公表値（円/㎡）
  estat_price integer,   -- 国交省 e-Stat API 算出値（円/㎡）
  custom_price integer,  -- 手動補正値（円/㎡）

  -- データの出典・算定根拠
  price_source text NOT NULL DEFAULT 'hardcode_initial',
  -- 'nta'                   : 国税庁公表値をそのまま使用
  -- 'nta_with_coefficient'  : 国税庁値に係数を適用
  -- 'estat'                 : e-Stat API 算出値をそのまま使用
  -- 'estat_with_coefficient': e-Stat 算出値に係数を適用
  -- 'custom'                : 手動設定値
  -- 'hardcode_initial'      : 移行時の暫定値（旧ハードコードから移行）

  derivation_note   text,    -- 算定根拠・係数の説明（自由記述）
  coefficient       numeric, -- 適用係数（例: 軽量鉄骨 = 鉄骨 × 0.90）
  coefficient_source text,   -- 係数の出典・根拠

  -- 公表情報
  published_year integer,    -- 元データの公表年度
  fetched_at timestamptz,    -- データ取得日時

  -- 承認管理（is_approved = true のものが本番査定に使用される）
  is_approved   boolean NOT NULL DEFAULT false,
  approved_at   timestamptz,
  approved_by   text,        -- 承認者名 or 'system' or 'migration'

  -- 暫定フラグ（正式なデータが未取得の場合に true）
  is_provisional      boolean NOT NULL DEFAULT false,
  provisional_reason  text,  -- 暫定である理由

  -- バージョン（更新のたびにインクリメント）
  version integer NOT NULL DEFAULT 1,

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- (year, structure) の組み合わせはユニーク
  UNIQUE (year, structure)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_construction_unit_prices_year
  ON construction_unit_prices (year);

CREATE INDEX IF NOT EXISTS idx_construction_unit_prices_approved
  ON construction_unit_prices (is_approved, year);

CREATE INDEX IF NOT EXISTS idx_construction_unit_prices_structure
  ON construction_unit_prices (structure);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_construction_unit_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_construction_unit_prices_updated_at
  BEFORE UPDATE ON construction_unit_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_construction_unit_prices_updated_at();

-- コメント
COMMENT ON TABLE construction_unit_prices IS
  '建築年別・構造別の建築単価テーブル。国税庁・国交省e-Stat等のソースを区別して管理。is_approved=trueの行が査定計算に使用される。';

COMMENT ON COLUMN construction_unit_prices.price_per_sqm IS
  '査定計算に実際に使用する単価（円/㎡）。国税庁値・e-Stat値・独自補正値のいずれかが入る。';

COMMENT ON COLUMN construction_unit_prices.nta_price IS
  '国税庁「建物の標準的な建築価額表」の公表値（円/㎡）。軽量鉄骨はNTAに独立列なしのためNULL可。';

COMMENT ON COLUMN construction_unit_prices.estat_price IS
  '国交省建築着工統計（e-Stat API）から算出した構造別単価（円/㎡）。住宅用途に限定した集計を推奨。';

COMMENT ON COLUMN construction_unit_prices.is_provisional IS
  'true=正式データが未取得の暫定値。1983〜2011年の旧ハードコード値および軽量鉄骨の全年度が対象。';
