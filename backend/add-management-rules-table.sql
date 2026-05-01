-- 管理規約解析結果を保存するテーブル
CREATE TABLE IF NOT EXISTS management_rules_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_number TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '[]',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- property_numberにインデックス
CREATE INDEX IF NOT EXISTS idx_management_rules_analysis_property_number
  ON management_rules_analysis(property_number);

-- 同じ物件番号は1件のみ（upsert用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_management_rules_analysis_property_number_unique
  ON management_rules_analysis(property_number);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_management_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_management_rules_updated_at
  BEFORE UPDATE ON management_rules_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_management_rules_updated_at();
