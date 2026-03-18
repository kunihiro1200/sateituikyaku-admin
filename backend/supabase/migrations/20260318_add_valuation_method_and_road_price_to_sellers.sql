-- Add valuation_method and fixed_asset_tax_road_price columns to sellers table
-- valuation_method: 査定方法（机上/訪問等）
-- fixed_asset_tax_road_price: 固定資産税路線価

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS fixed_asset_tax_road_price NUMERIC;

COMMENT ON COLUMN sellers.valuation_method IS '査定方法（机上/訪問等）';
COMMENT ON COLUMN sellers.fixed_asset_tax_road_price IS '固定資産税路線価';
