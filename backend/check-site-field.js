// サイトフィールドがDBに保存されているか確認するスクリプト
var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// 5/28に登録された売主のinquiry_siteを確認
var path = '/rest/v1/sellers?inquiry_date=eq.2026-05-28&select=seller_number,inquiry_site,inquiry_date&order=created_at.desc&limit=20';

var req = https.request({
  hostname: SUPABASE_URL,
  path: path,
  method: 'GET',
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var sellers = JSON.parse(data);
    console.log('=== 5/28登録の売主 inquiry_site確認 ===');
    console.log('件数:', sellers.length);
    sellers.forEach(function(s) {
      console.log(s.seller_number + ': inquiry_site="' + (s.inquiry_site || 'NULL') + '"  inquiry_date=' + s.inquiry_date);
    });
  });
});
req.end();
