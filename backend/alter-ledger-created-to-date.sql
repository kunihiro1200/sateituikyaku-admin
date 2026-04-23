-- Migration: ledger_created カラムを TEXT から DATE 型に変更
-- タイムゾーン付き文字列（例: "2025-01-15 gmt+0900"）にも対応

ALTER TABLE work_tasks
  ALTER COLUMN ledger_created TYPE DATE
  USING CASE
    WHEN ledger_created IS NULL OR ledger_created = '' THEN NULL
    ELSE (regexp_replace(ledger_created, '\s*(gmt|GMT)[+-]\d{4}.*$', ''))::DATE
  END;
