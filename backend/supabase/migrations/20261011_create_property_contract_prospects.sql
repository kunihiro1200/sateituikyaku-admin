-- ============================================================
-- 成約見込み管理テーブル
-- 大分店・専任媒介物件の成約見込みを管理する
-- property_listings テーブルは変更しない（関連テーブルとして新規作成）
-- ============================================================

CREATE TABLE IF NOT EXISTS property_contract_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 物件番号（property_listings への外部キー）
  property_number VARCHAR(50) NOT NULL,

  -- ① 担当者入力項目 -------------------------------------------

  -- 成約見込みランク（A:高い B:ある C:改善で期待 D:難しい）
  prospect_rank VARCHAR(1) CHECK (prospect_rank IN ('A', 'B', 'C', 'D')),

  -- 決済見込み年月（YYYY-MM 形式）
  settlement_expected_month VARCHAR(7),

  -- 成約見込みの判断理由
  assessment_reason TEXT,

  -- 成約に向けた必要な対策
  required_actions TEXT,

  -- ② 山本マネージャー確認 -------------------------------------

  -- 確認状況（未確認 / 確認済み / 要見直し）
  manager_check_status VARCHAR(10) NOT NULL DEFAULT '未確認'
    CHECK (manager_check_status IN ('未確認', '確認済み', '要見直し')),

  -- マネージャーコメント（要見直し選択時に使用）
  manager_comment TEXT,

  -- 確認日時・確認者
  manager_checked_at TIMESTAMPTZ,
  manager_checked_by VARCHAR(100),

  -- ③ 変更履歴（JSONB 配列）------------------------------------
  -- 例: [{ "changed_at": "...", "changed_by": "山本", "changes": { "prospect_rank": { "from": "B", "to": "A" } } }]
  change_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ④ メタデータ -----------------------------------------------
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100),
  updated_by VARCHAR(100),

  -- 外部キー制約（物件番号は property_listings に存在するものだけ）
  CONSTRAINT fk_pcp_property_number
    FOREIGN KEY (property_number)
    REFERENCES property_listings(property_number)
    ON DELETE RESTRICT
);

-- 物件番号はユニーク（1物件につき1レコード）
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcp_property_number
  ON property_contract_prospects(property_number);

-- 検索・集計用インデックス
CREATE INDEX IF NOT EXISTS idx_pcp_prospect_rank
  ON property_contract_prospects(prospect_rank);

CREATE INDEX IF NOT EXISTS idx_pcp_manager_check_status
  ON property_contract_prospects(manager_check_status);

CREATE INDEX IF NOT EXISTS idx_pcp_settlement_expected_month
  ON property_contract_prospects(settlement_expected_month);

CREATE INDEX IF NOT EXISTS idx_pcp_updated_at
  ON property_contract_prospects(updated_at DESC);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_pcp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pcp_updated_at ON property_contract_prospects;
CREATE TRIGGER trg_pcp_updated_at
  BEFORE UPDATE ON property_contract_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_pcp_updated_at();

-- テーブル・カラムコメント
COMMENT ON TABLE property_contract_prospects IS
  '成約見込み管理テーブル — 大分店の専任媒介物件について担当者が成約見込みを入力し、マネージャーが確認する';

COMMENT ON COLUMN property_contract_prospects.prospect_rank IS
  '成約見込みランク（A:高い B:ある C:改善により期待 D:現状難しい）';

COMMENT ON COLUMN property_contract_prospects.settlement_expected_month IS
  '決済見込み年月（YYYY-MM 形式）';

COMMENT ON COLUMN property_contract_prospects.assessment_reason IS
  '成約見込みの判断理由（担当者入力）';

COMMENT ON COLUMN property_contract_prospects.required_actions IS
  '成約に向けた必要な対策（担当者入力）';

COMMENT ON COLUMN property_contract_prospects.manager_check_status IS
  'マネージャー確認状況（未確認 / 確認済み / 要見直し）';

COMMENT ON COLUMN property_contract_prospects.manager_comment IS
  'マネージャーコメント — 要見直し選択時に理由を入力';

COMMENT ON COLUMN property_contract_prospects.change_history IS
  '変更履歴 JSONB 配列 — 担当者・マネージャーによる変更を記録';
