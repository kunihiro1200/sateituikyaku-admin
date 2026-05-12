-- 建売専門HP価格変動通知のテスト用SQL

-- ステップ1: テスト用物件を1件選んで価格を変更
-- 例: 最初の物件の価格を「3,000万円」→「2,800万円」に変更
UPDATE property_previews
SET price = '2,800万円'
WHERE slug = (
  SELECT slug 
  FROM property_previews 
  WHERE is_tateuri = true 
    AND is_active = true 
    AND price IS NOT NULL
  ORDER BY slug
  LIMIT 1
);

-- 変更した物件のslugを確認
SELECT slug, title, price, source_url
FROM property_previews
WHERE is_tateuri = true 
  AND is_active = true 
  AND price IS NOT NULL
ORDER BY slug
LIMIT 1;

-- ステップ2: 価格チェックを実行（ブラウザで以下のURLを開く）
-- https://sateituikyaku-admin-backend.vercel.app/api/tateuri/cron/price-check?limit=1

-- ステップ3: tenant@ifoo-oita.com のメールボックスを確認
-- 件名: 【建売専門HP】値下げ1件

-- ステップ4: テスト後、元の価格に戻す（スクレイピングで自動的に戻ります）
