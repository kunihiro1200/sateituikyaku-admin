-- 買主7726のデータを確認
SELECT 
  buyer_number,
  name,
  other_company_property,
  inquiry_email_reply,
  inquiry_email_phone,
  inquiry_source,
  property_address,
  latest_viewing_date,
  created_at
FROM buyers
WHERE buyer_number = '7726';
