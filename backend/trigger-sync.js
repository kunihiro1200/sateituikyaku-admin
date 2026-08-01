var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

var req = https.request({
  hostname: SUPABASE_URL,
  path: '/rest/v1/sellers?seller_number=eq.AA14275&select=id',
  method: 'GET',
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var sellers = JSON.parse(data);
    console.log('Seller ID:', sellers[0].id);
    var sellerId = sellers[0].id;

    // Check properties
    var req2 = https.request({
      hostname: SUPABASE_URL,
      path: '/rest/v1/properties?seller_id=eq.' + sellerId + '&select=id',
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, function(res2) {
      var data2 = '';
      res2.on('data', function(chunk) { data2 += chunk; });
      res2.on('end', function() {
        var props = JSON.parse(data2);
        console.log('Properties count:', props.length);
        if (props.length === 0) {
          console.log('No property record. Creating...');
          var body = JSON.stringify({ seller_id: sellerId, property_number: 'AA14275', status: 'active' });
          var req3 = https.request({
            hostname: SUPABASE_URL,
            path: '/rest/v1/properties',
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
          }, function(res3) {
            var data3 = '';
            res3.on('data', function(chunk) { data3 += chunk; });
            res3.on('end', function() { console.log('Create result:', res3.statusCode, data3.substring(0, 200)); });
          });
          req3.write(body);
          req3.end();
        } else {
          console.log('Property exists:', JSON.stringify(props[0]));
        }
      });
    });
    req2.end();
  });
});
req.end();
