var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

var path = '/rest/v1/property_listings?sales_assignee=in.(' + encodeURIComponent('麻生') + ',' + encodeURIComponent('久米') + ',' + encodeURIComponent('久') + ',' + encodeURIComponent('林田') + ')&select=property_number,sales_assignee,sidebar_status,atbb_status&limit=30';

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
    results.forEach(function(r) {
      console.log(r.property_number, '|', r.sales_assignee, '|', r.sidebar_status, '|', r.atbb_status);
    });
  });
});
req.end();
