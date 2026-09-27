-- 物件リストの「よく聞かれる項目」の固定資産税に「約」表示フラグを追加
-- 金額（property_tax）はそのまま維持し、「約80,000円」のように「約」を付けて表示できるようにする

ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS property_tax_approx BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN property_listings.property_tax_approx IS '固定資産税の金額に「約」を付けて表示するフラグ（true=約XXX円）';
