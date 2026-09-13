-- ============================================================
-- buyers テーブルに「カレンダーに反映しましたか？」チェック項目を追加
-- 目的:
--   - calendar_reflected: 内覧日をカレンダーで開く後、カレンダーに反映したかの確認チェック
-- 関連ページ: 買主リスト → 内覧結果・後続対応 (BuyerViewingResultPage)
-- ============================================================

-- カレンダーに反映したかチェック
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS calendar_reflected BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN buyers.calendar_reflected IS '内覧結果・後続対応：カレンダーに反映しましたか？（チェックボックス／内覧日があるとき必須）';
