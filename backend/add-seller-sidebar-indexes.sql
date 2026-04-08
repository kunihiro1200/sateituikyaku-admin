-- 売主サイドバーカウントのパフォーマンス改善用インデックス
-- 目的: /api/sellers/sidebar-counts エンドポイントの応答時間を7-8秒から3-4秒に短縮
-- 作成日: 2026年4月9日

-- 1. 営担インデックス（訪問日前日、訪問済み、当日TEL担当、担当イニシャル親カテゴリ用）
CREATE INDEX IF NOT EXISTS idx_sellers_visit_assignee 
ON sellers(visit_assignee) 
WHERE deleted_at IS NULL;

-- 2. 次電日インデックス（当日TEL分、当日TEL担当用）
CREATE INDEX IF NOT EXISTS idx_sellers_next_call_date 
ON sellers(next_call_date) 
WHERE deleted_at IS NULL;

-- 3. 訪問日インデックス（訪問日前日、訪問済み用）
CREATE INDEX IF NOT EXISTS idx_sellers_visit_date 
ON sellers(visit_date) 
WHERE deleted_at IS NULL;

-- 4. 状況（当社）インデックス（部分一致用・GINインデックス）
-- 注意: pg_trgm拡張が必要
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_sellers_status_gin 
ON sellers USING gin(status gin_trgm_ops);

-- 5. 複合インデックス（当日TEL分用）
-- 条件: status ILIKE '%追客中%' AND next_call_date <= TODAY AND visit_assignee IS NULL
CREATE INDEX IF NOT EXISTS idx_sellers_today_call 
ON sellers(status, next_call_date, visit_assignee) 
WHERE deleted_at IS NULL;

-- 6. 反響日付インデックス（未査定、当日TEL_未着手用）
CREATE INDEX IF NOT EXISTS idx_sellers_inquiry_date 
ON sellers(inquiry_date) 
WHERE deleted_at IS NULL;

-- 7. 郵送ステータスインデックス（査定（郵送）用）
CREATE INDEX IF NOT EXISTS idx_sellers_mailing_status 
ON sellers(mailing_status) 
WHERE deleted_at IS NULL;

-- インデックス作成完了
-- 確認方法:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sellers' AND indexname LIKE 'idx_sellers_%';
