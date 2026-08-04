-- マンション用 平米単価計算欄を追加（通話モードページ「手入力査定額」セクション用）
-- 種別に「マ」が含まれる場合のみUIに表示される、平米単価×建物面積の自動計算補助欄
-- 🚨 DBに保存するのみ。スプレッドシートへの同期は不要（column-mapping.jsonにマッピングを追加しないこと）

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS manual_unit_price_1 NUMERIC,
ADD COLUMN IF NOT EXISTS manual_unit_price_2 NUMERIC,
ADD COLUMN IF NOT EXISTS manual_unit_price_3 NUMERIC,
ADD COLUMN IF NOT EXISTS manual_unit_price_amount_1 NUMERIC,
ADD COLUMN IF NOT EXISTS manual_unit_price_amount_2 NUMERIC,
ADD COLUMN IF NOT EXISTS manual_unit_price_amount_3 NUMERIC;

COMMENT ON COLUMN sellers.manual_unit_price_1 IS 'マンション査定用 平米単価1（万円/㎡）。通話モードページの手入力査定額セクションで使用。DB保存のみ・スプシ同期なし';
COMMENT ON COLUMN sellers.manual_unit_price_2 IS 'マンション査定用 平米単価2（万円/㎡）。DB保存のみ・スプシ同期なし';
COMMENT ON COLUMN sellers.manual_unit_price_3 IS 'マンション査定用 平米単価3（万円/㎡）。DB保存のみ・スプシ同期なし';
COMMENT ON COLUMN sellers.manual_unit_price_amount_1 IS '平米単価1×建物面積の自動計算結果（万円）。DB保存のみ・スプシ同期なし';
COMMENT ON COLUMN sellers.manual_unit_price_amount_2 IS '平米単価2×建物面積の自動計算結果（万円）。DB保存のみ・スプシ同期なし';
COMMENT ON COLUMN sellers.manual_unit_price_amount_3 IS '平米単価3×建物面積の自動計算結果（万円）。DB保存のみ・スプシ同期なし';
