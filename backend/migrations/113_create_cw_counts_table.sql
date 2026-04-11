-- ============================================================
-- マイグレーション: 113_create_cw_counts_table.sql
-- 目的: CWカウントシートのデータを格納する cw_counts テーブルを作成する
-- 作成日: 2026年
-- 関連スペック: business-request-site-registration-tab-enhancement
-- ============================================================

-- cw_counts テーブルの作成
-- GASが定期的にCWカウントシートのデータをupsertするためのテーブル
CREATE TABLE IF NOT EXISTS cw_counts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name   TEXT        NOT NULL UNIQUE,          -- 「項目」列の値（例: 「間取図（300円）」「サイト登録」）
  current_total TEXT,                               -- 「現在計」列の値
  synced_at   TIMESTAMPTZ DEFAULT NOW(),            -- 最終同期日時（GASが更新）
  updated_at  TIMESTAMPTZ DEFAULT NOW()             -- 最終更新日時
);

-- テーブルコメント
COMMENT ON TABLE cw_counts IS 'CWカウントシートのデータを格納するテーブル。GASが10分ごとに同期する。';
COMMENT ON COLUMN cw_counts.id IS '主キー（UUID）';
COMMENT ON COLUMN cw_counts.item_name IS '項目名（例: 間取図（300円）、サイト登録）。UNIQUE制約あり。';
COMMENT ON COLUMN cw_counts.current_total IS '現在計の値（スプレッドシートの「現在計」列）';
COMMENT ON COLUMN cw_counts.synced_at IS 'GASによる最終同期日時';
COMMENT ON COLUMN cw_counts.updated_at IS 'レコードの最終更新日時';

-- ============================================================
-- RLS（Row Level Security）の設定
-- ============================================================

-- RLSを有効化
ALTER TABLE cw_counts ENABLE ROW LEVEL SECURITY;

-- ポリシー1: 認証済みユーザーによるSELECTを許可
-- フロントエンドからSupabase JSクライアント経由でデータを読み取るために必要
CREATE POLICY "認証済みユーザーはcw_countsを参照可能"
  ON cw_counts
  FOR SELECT
  TO authenticated
  USING (true);

-- ポリシー2: service_roleによるINSERT/UPDATE/DELETEを許可
-- GASからのupsert操作はservice_roleキーを使用するため
CREATE POLICY "service_roleはcw_countsを全操作可能"
  ON cw_counts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- インデックスの作成
-- ============================================================

-- item_name はUNIQUE制約により自動的にインデックスが作成されるが、
-- 検索パフォーマンス向上のため明示的にインデックスを追加
CREATE INDEX IF NOT EXISTS idx_cw_counts_item_name ON cw_counts (item_name);
