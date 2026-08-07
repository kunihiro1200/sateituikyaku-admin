-- 資料生成ドラフト保存テーブル
-- 売却スケジュール・手残りリスト・送付状の最終印刷時データを保存
CREATE TABLE IF NOT EXISTS document_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_number VARCHAR(20) NOT NULL,   -- 売主番号（例: FI737, AA13501）
  document_type VARCHAR(50) NOT NULL,   -- 'sale_schedule' | 'net_proceeds' | 'souhu'
  data JSONB NOT NULL,                  -- 各モーダルのフォームデータ（JSON）
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 売主番号+種別でユニーク（1種別1レコード、上書き保存）
  CONSTRAINT document_drafts_seller_type_unique UNIQUE (seller_number, document_type)
);

CREATE INDEX IF NOT EXISTS idx_document_drafts_seller_number ON document_drafts(seller_number);
CREATE INDEX IF NOT EXISTS idx_document_drafts_saved_at ON document_drafts(saved_at DESC);

-- RLS
ALTER TABLE document_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access document_drafts" ON document_drafts;
CREATE POLICY "Service role full access document_drafts"
  ON document_drafts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users document_drafts" ON document_drafts;
CREATE POLICY "Authenticated users document_drafts"
  ON document_drafts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_document_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_drafts_updated_at ON document_drafts;
CREATE TRIGGER trg_document_drafts_updated_at
  BEFORE UPDATE ON document_drafts
  FOR EACH ROW EXECUTE FUNCTION update_document_drafts_updated_at();
