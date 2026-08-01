// 最近のHOME4U登録を確認
var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// HOME4U (inquiry_site='H') の最新10件を確認
var path = '/rest/v1/sellers?inquiry_site=eq.H&select=seller_number,inquiry_site,inquiry_date,created_at&order=created_at.desc&limit=10';

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
    console.log('=== HOME4U (inquiry_site=H) 最新10件 ===');
    console.log('件数:', sellers.length);
    sellers.forEach(function(s) {
      console.log(s.seller_number + ': inquiry_date=' + s.inquiry_date + '  created_at=' + s.created_at);
    });
  });
});
req.end();
