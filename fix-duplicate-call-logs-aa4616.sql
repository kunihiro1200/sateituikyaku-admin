-- =====================================================
-- AA4616（内川義浩）の売主追客ログ重複削除
-- 2026/07/10 17:15〜17:16 和田樹奈が3件誤って記録 → 1件にする
-- =====================================================

-- ステップ1: 対象レコードを確認
-- まず売主IDを特定
SELECT id, seller_number, name
FROM sellers
WHERE seller_number = 'AA4616';

-- ステップ2: 該当時間帯のphone_callアクティビティを確認
-- JSTで2026/07/10 17:15〜17:16 → UTCで2026/07/10 08:15〜08:17
SELECT 
  a.id,
  a.seller_id,
  a.type,
  a.employee_id,
  a.created_at,
  a.created_at AT TIME ZONE 'Asia/Tokyo' AS created_at_jst,
  e.name AS employee_name
FROM activities a
JOIN employees e ON e.id = a.employee_id
WHERE a.seller_id = (SELECT id FROM sellers WHERE seller_number = 'AA4616')
  AND a.type = 'phone_call'
  AND a.created_at >= '2026-07-10T08:14:00Z'
  AND a.created_at <= '2026-07-10T08:17:00Z'
ORDER BY a.created_at;

-- ステップ3: 3件中2件を削除（最初の1件を残す）
-- ※ 上記SELECTで3件確認後、最初の1件のIDを残して他を削除する
-- 実行前に必ずSELECTで確認してください

-- 方法: 最も古い1件を残し、残りを削除
DELETE FROM activities
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
    FROM activities
    WHERE seller_id = (SELECT id FROM sellers WHERE seller_number = 'AA4616')
      AND type = 'phone_call'
      AND created_at >= '2026-07-10T08:14:00Z'
      AND created_at <= '2026-07-10T08:17:00Z'
  ) sub
  WHERE rn > 1  -- 最初の1件以外を削除
);
