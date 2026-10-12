-- ============================================================
-- Drive同期システム用テーブル（2026年10月）
--
-- 物件別スプレッドシート → DB リアルタイム同期のために
-- 以下の3テーブルを追加する。
-- 既存テーブル（work_tasks等）は一切変更しない。
-- ============================================================

-- 1. Drive watch チャンネル管理テーブル
--    2つのドライブ（通常フォルダ用・共有ドライブ用）の
--    watchチャンネルとpageTokenを管理する。
CREATE TABLE IF NOT EXISTS drive_watch_state (
  drive_id          TEXT PRIMARY KEY,            -- 'my_drive' または 共有DriveID
  page_token        TEXT,                         -- 最後に処理した changes.list の pageToken
  channel_id        TEXT,                         -- Google Drive watch チャンネルID（UUID）
  resource_id       TEXT,                         -- Google が返す resource_id（停止時に使用）
  expiration_at     TIMESTAMPTZ,                  -- チャンネルの有効期限（最大7日）
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ファイルID ↔ 物件番号 マッピングテーブル
--    変更通知のfileIdから物件番号を高速に引くためのキャッシュ。
--    媒介依頼!A2 を読まなくても物件番号を特定できる。
CREATE TABLE IF NOT EXISTS property_spreadsheet_registry (
  file_id           TEXT PRIMARY KEY,             -- Google Drive ファイルID
  property_number   TEXT NOT NULL,                -- 物件番号（AA12345 等）
  spreadsheet_url   TEXT,                         -- スプレッドシートのURL
  registered_at     TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ                   -- 最後に正常同期した日時
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_property_number
  ON property_spreadsheet_registry (property_number);

CREATE INDEX IF NOT EXISTS idx_registry_last_synced
  ON property_spreadsheet_registry (last_synced_at);

-- 3. 同期ログ・リトライキューテーブル
--    すべての同期試行を記録し、失敗時のリトライを管理する。
CREATE TABLE IF NOT EXISTS drive_sync_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id         TEXT NOT NULL,
  property_number TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending/success/failed/max_retry
  retry_count     INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  synced_at       TIMESTAMPTZ                        -- 成功した場合の完了時刻
);

CREATE INDEX IF NOT EXISTS idx_sync_log_status_retry
  ON drive_sync_log (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_sync_log_property_created
  ON drive_sync_log (property_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_file_id
  ON drive_sync_log (file_id, created_at DESC);

-- 初期データ挿入（通常フォルダ・共有ドライブそれぞれのレコードを確保）
INSERT INTO drive_watch_state (drive_id, updated_at)
VALUES
  ('my_drive',               NOW()),
  ('0AJd1KlohTQaTUk9PVA',   NOW())
ON CONFLICT (drive_id) DO NOTHING;
