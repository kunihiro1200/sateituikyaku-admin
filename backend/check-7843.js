var https = require('https');
var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';
var req = https.request({
  hostname: 'krxhrbtlgfjzsseegaqq.supabase.co',
  path: '/rest/v1/buyers?buyer_number=eq.7843&select=buyer_number,email,pinrich,broker_inquiry,reception_date,inquiry_source,inquiry_email_phone,inquiry_email_reply,initial_assignee,next_call_date,latest_viewing_date',
  method: 'GET',
  headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
}, function(res) {
  var d = '';
  res.on('data', function(c) { d += c; });
  res.on('end', function() { console.log(d); process.exit(0); });
});
req.on('error', function(e) { console.error(e.message); process.exit(1); });
req.end();
