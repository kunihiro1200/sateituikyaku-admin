-- ガーデンヒルズ内野5のslugを正確に確認
SELECT slug, title, address, source_url, region, is_active, is_tateuri
FROM property_previews
WHERE title LIKE '%ガーデンヒルズ内野%'
   OR address LIKE '%早良%'
   OR address LIKE '%福岡%';
