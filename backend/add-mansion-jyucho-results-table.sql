-- マンション重調解析結果テーブル
CREATE TABLE IF NOT EXISTS mansion_jyucho_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_number TEXT NOT NULL UNIQUE,
  results JSONB NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_mansion_jyucho_results_property_number
  ON mansion_jyucho_results (property_number);

-- RLS（Row Level Security）は管理規約テーブルと同様に無効化
ALTER TABLE mansion_jyucho_results DISABLE ROW LEVEL SECURITY;

-- コメント
COMMENT ON TABLE mansion_jyucho_results IS 'マンション重要事項説明書（重調）の解析結果を保存するテーブル';
COMMENT ON COLUMN mansion_jyucho_results.property_number IS '物件番号（一意）';
COMMENT ON COLUMN mansion_jyucho_results.results IS '解析結果（JSON配列）';
COMMENT ON COLUMN mansion_jyucho_results.analyzed_at IS '解析日時';
