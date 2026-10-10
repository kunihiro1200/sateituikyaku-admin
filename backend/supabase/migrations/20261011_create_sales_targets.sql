-- ============================================================
-- 売上目標管理テーブル
-- 大分店の年度目標を担当者別・店舗全体別に管理する
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 会計年度（例: '2026-2027' = 2026年10月〜2027年9月）
  fiscal_year VARCHAR(9) NOT NULL,

  -- 店舗名
  store_name VARCHAR(50) NOT NULL DEFAULT '大分店',

  -- 担当者名（'' = 店舗全体目標、'山本' 等 = 個人目標）
  staff_name VARCHAR(100) NOT NULL DEFAULT '',

  -- 目標金額（税込、円）
  target_amount DECIMAL(15,0) NOT NULL DEFAULT 0,

  -- メモ
  notes TEXT,

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ユニーク制約（店舗×担当者×年度で1件）
  CONSTRAINT uq_sales_targets UNIQUE (fiscal_year, store_name, staff_name)
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_sales_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_targets_updated_at ON sales_targets;
CREATE TRIGGER trg_sales_targets_updated_at
  BEFORE UPDATE ON sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_targets_updated_at();

-- 初期データ：大分店 2026-2027 全体目標 1.2億円
INSERT INTO sales_targets (fiscal_year, store_name, staff_name, target_amount, notes)
VALUES ('2026-2027', '大分店', '', 120000000, '大分店全体目標 1.2億円（税込）')
ON CONFLICT (fiscal_year, store_name, staff_name) DO NOTHING;

COMMENT ON TABLE sales_targets IS
  '売上目標管理テーブル — 大分店の年度目標を店舗全体・担当者別に管理する';
COMMENT ON COLUMN sales_targets.staff_name IS
  '担当者名。空文字（''）＝店舗全体目標、''山本'' 等＝個人目標';
COMMENT ON COLUMN sales_targets.target_amount IS
  '目標金額（税込・円）';
