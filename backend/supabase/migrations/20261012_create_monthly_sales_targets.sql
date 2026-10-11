-- ============================================================
-- 月別売上目標管理テーブル
-- 年間目標（sales_targets）とは別に月別で目標を管理する
-- 店舗全体（staff_name=''）と担当者個人（staff_name='山本' 等）の両方を保持
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_sales_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 会計年度（例: '2026-2027'）
  fiscal_year  VARCHAR(9)    NOT NULL,

  -- 対象月（YYYY-MM 形式）
  month        VARCHAR(7)    NOT NULL,

  -- 店舗名
  store_name   VARCHAR(50)   NOT NULL DEFAULT '大分店',

  -- 担当者名（'' = 店舗全体目標、'山本' 等 = 個人月別目標）
  staff_name   VARCHAR(100)  NOT NULL DEFAULT '',

  -- 目標金額（税込・円）
  target_amount DECIMAL(15,0) NOT NULL DEFAULT 0,

  -- メモ
  notes TEXT,

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ユニーク制約
  CONSTRAINT uq_monthly_sales_targets UNIQUE (fiscal_year, month, store_name, staff_name)
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_monthly_sales_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_monthly_sales_targets_updated_at ON monthly_sales_targets;
CREATE TRIGGER trg_monthly_sales_targets_updated_at
  BEFORE UPDATE ON monthly_sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_sales_targets_updated_at();

-- インデックス
CREATE INDEX IF NOT EXISTS idx_mst_fiscal_year_month
  ON monthly_sales_targets(fiscal_year, month);

CREATE INDEX IF NOT EXISTS idx_mst_staff
  ON monthly_sales_targets(fiscal_year, store_name, staff_name);

COMMENT ON TABLE monthly_sales_targets IS
  '月別売上目標テーブル — 大分店の月別売上目標を店舗全体・担当者別に管理する';
COMMENT ON COLUMN monthly_sales_targets.staff_name IS
  '担当者名。空文字（''''）＝店舗全体目標、''山本'' 等＝個人月別目標';
COMMENT ON COLUMN monthly_sales_targets.target_amount IS
  '月別目標金額（税込・円）';
