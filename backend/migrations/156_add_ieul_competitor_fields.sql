-- イエウール他決候補フラグ
-- ieul_competitor: スプシ「イエウールデータ」のK列（いふう記入欄）に売主番号が存在する場合 true
-- ieul_competitor_checked_at: 確認済みボタンを押した日時（入っていればサイドバーから除外）

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS ieul_competitor BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ieul_competitor_checked_at TIMESTAMPTZ;

-- 検索用インデックス（サイドバーカウント高速化）
CREATE INDEX IF NOT EXISTS idx_sellers_ieul_competitor
  ON sellers (ieul_competitor, ieul_competitor_checked_at)
  WHERE deleted_at IS NULL;
