var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// Get all properties with sales_assignee in (麻生, 久米, 久) that have atbb_status = 専任・公開中
var path = '/rest/v1/property_listings?sales_assignee=in.(' + encodeURIComponent('麻生') + ',' + encodeURIComponent('久米') + ',' + encodeURIComponent('久') + ')&atbb_status=eq.' + encodeURIComponent('専任・公開中') + '&select=property_number,sales_assignee,sidebar_status,atbb_status,report_date,price_reduction_scheduled_date,confirmation&limit=50';

var req = https.request({
  hostname: SUPABASE_URL,
  path: path,
  method: 'GET',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY
  }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var results = JSON.parse(data);
    console.log('Total results:', results.length);
    console.log('');
    results.forEach(function(r) {
      console.log(JSON.stringify(r));
    });
  });
});
req.end();
