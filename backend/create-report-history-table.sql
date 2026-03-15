-- 報告書送信履歴テーブル
CREATE TABLE IF NOT EXISTS property_report_history (
  id BIGSERIAL PRIMARY KEY,
  property_number TEXT NOT NULL,
  template_name TEXT,
  subject TEXT,
  report_date DATE,
  report_assignee TEXT,
  report_completed TEXT DEFAULT 'N',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_report_history_property_number
  ON property_report_history(property_number);

CREATE INDEX IF NOT EXISTS idx_property_report_history_sent_at
  ON property_report_history(sent_at DESC);
