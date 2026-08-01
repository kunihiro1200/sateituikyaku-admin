-- activity_logs テーブルから activities テーブルにメール送信履歴を移行するSQL
-- 対象: 2026年3月27日以降に送信されたメール（saveEmailLogが削除された日以降）
-- 実行前に SELECT で確認してから INSERT を実行してください

-- ステップ1: 移行対象データの確認（まずこれを実行して件数を確認）
SELECT 
  al.id,
  al.target_id AS seller_id,
  al.employee_id,
  al.action,
  al.metadata->>'subject' AS subject,
  al.metadata->>'recipient_email' AS recipient_email,
  al.created_at
FROM activity_logs al
WHERE al.action = 'email'
  AND al.target_type = 'seller'
  AND al.target_id IS NOT NULL
  AND al.target_id != ''
  AND al.created_at >= '2026-03-27T00:00:00+09:00'
  -- 既にactivitiesテーブルに存在するレコードを除外（重複防止）
  AND NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.seller_id = al.target_id::uuid
      AND a.type = 'email'
      AND a.created_at = al.created_at
  )
ORDER BY al.created_at DESC;

-- ステップ2: 移行実行（上記SELECTで確認後に実行）
INSERT INTO activities (seller_id, employee_id, type, content, result, metadata, created_at)
SELECT 
  al.target_id::uuid AS seller_id,
  COALESCE(al.employee_id, '00000000-0000-0000-0000-000000000000') AS employee_id,
  'email' AS type,
  'メール送信: ' || COALESCE(al.metadata->>'subject', '(件名なし)') AS content,
  '送信成功' AS result,
  jsonb_build_object(
    'subject', COALESCE(al.metadata->>'subject', ''),
    'body', COALESCE(al.metadata->>'body', ''),
    'recipient_email', COALESCE(al.metadata->>'recipient_email', ''),
    'sent_at', al.created_at::text,
    'migrated_from', 'activity_logs',
    'original_id', al.id::text
  ) AS metadata,
  al.created_at
FROM activity_logs al
WHERE al.action = 'email'
  AND al.target_type = 'seller'
  AND al.target_id IS NOT NULL
  AND al.target_id != ''
  AND al.created_at >= '2026-03-27T00:00:00+09:00'
  -- target_idがUUID形式であることを確認
  AND al.target_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  -- 既にactivitiesテーブルに存在するレコードを除外（重複防止）
  AND NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.seller_id = al.target_id::uuid
      AND a.type = 'email'
      AND a.created_at = al.created_at
  );
