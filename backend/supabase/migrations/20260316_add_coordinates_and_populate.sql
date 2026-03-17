-- Step 1: coordinatesカラムを追加
ALTER TABLE area_map_config
ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL;

-- Step 2: 各エリアの座標を登録（URLから事前に抽出済みの値）
UPDATE area_map_config SET coordinates = '{"lat": 33.2352055, "lng": 131.5759307}' WHERE area_number = '①';
UPDATE area_map_config SET coordinates = '{"lat": 33.2394777, "lng": 131.6425875}' WHERE area_number = '②';
UPDATE area_map_config SET coordinates = '{"lat": 33.2099143, "lng": 131.6732689}' WHERE area_number = '③';
UPDATE area_map_config SET coordinates = '{"lat": 33.2092757, "lng": 131.6902399}' WHERE area_number = '④';
UPDATE area_map_config SET coordinates = '{"lat": 33.2062377, "lng": 131.5576142}' WHERE area_number = '⑥';
UPDATE area_map_config SET coordinates = '{"lat": 33.1548875, "lng": 131.5198837}' WHERE area_number = '⑦';
UPDATE area_map_config SET coordinates = '{"lat": 33.1336355, "lng": 131.6481517}' WHERE area_number = '⑧';
UPDATE area_map_config SET coordinates = '{"lat": 33.2896237, "lng": 131.4804615}' WHERE area_number = '⑨';
UPDATE area_map_config SET coordinates = '{"lat": 33.2922956, "lng": 131.4874659}' WHERE area_number = '⑩';
UPDATE area_map_config SET coordinates = '{"lat": 33.4262837, "lng": 131.2337202}' WHERE area_number = '⑪';
UPDATE area_map_config SET coordinates = '{"lat": 33.3110075, "lng": 131.4635217}' WHERE area_number = '⑫';
UPDATE area_map_config SET coordinates = '{"lat": 33.2670697, "lng": 131.4463802}' WHERE area_number = '⑬';
UPDATE area_map_config SET coordinates = '{"lat": 33.2997755, "lng": 131.4864557}' WHERE area_number = '⑭';
UPDATE area_map_config SET coordinates = '{"lat": 33.273884,  "lng": 131.4903395}' WHERE area_number = '⑮';
