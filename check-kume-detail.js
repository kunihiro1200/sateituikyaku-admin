var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// Get full details for AA14370 and AA14053
var path = '/rest/v1/property_listings?property_number=in.(AA14370,AA14053)&select=property_number,sales_assignee,sidebar_status,atbb_status,report_date,price_reduction_scheduled_date,confirmation,suumo_url,suumo_registered,offer_status,general_mediation_private,single_listing';

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
    results.forEach(function(r) {
      console.log(JSON.stringify(r, null, 2));
      console.log('---');
    });
  });
});
req.end();
