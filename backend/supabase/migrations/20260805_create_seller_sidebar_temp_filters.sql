-- 売主リストサイドバーへの「一時追加フィルター」機能用テーブル
-- フィルタパネルから「サイドバーに一時追加」ボタンで作成したカスタムカテゴリーを保存する
-- 誰が作成したか分かるよう作成者名（イニシャル）をラベルに含めて表示する

CREATE TABLE IF NOT EXISTS seller_sidebar_temp_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(200) NOT NULL, -- 表示名（例: 「福岡・空家K」）
  created_by VARCHAR(100), -- 作成者のイニシャル・名前
  filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- SellersPageのフィルター条件をそのまま保存
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_sidebar_temp_filters_created_at ON seller_sidebar_temp_filters(created_at DESC);

COMMENT ON TABLE seller_sidebar_temp_filters IS '売主リストサイドバーへの一時追加フィルター（フィルタパネルから作成するカスタムカテゴリー）';
COMMENT ON COLUMN seller_sidebar_temp_filters.label IS '表示名（例: 福岡・空家K）';
COMMENT ON COLUMN seller_sidebar_temp_filters.created_by IS '作成者のイニシャル・名前';
COMMENT ON COLUMN seller_sidebar_temp_filters.filters IS 'SellersPageのフィルター条件をJSON形式で保存（region, confidenceLevel, inquirySite, propertyType, statusFilter, currentStatusFilter, inquiryDateFrom, inquiryDateTo, valuationAmountMin, valuationAmountMax, nextCallDateFrom, nextCallDateTo等）';
