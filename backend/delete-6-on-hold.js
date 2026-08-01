var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// IDで直接削除
var ids = [
  '09456c44-34e9-4b3d-bd49-06c0f85663a0',
  '95c0222a-8248-4796-bc3d-8888621c419b',
  'f04278eb-15d5-48fa-9f04-fb092accb683',
  'd5c10ff9-c25d-4cb1-8a1f-62ac5c399140',
  '2fe38e25-e68c-4127-9457-6007784aea5d',
  'd72530c5-e267-4127-a263-7c8c596998b8'
];

var path = '/rest/v1/work_tasks?id=in.(' + ids.join(',') + ')';
var req = https.request({
  hostname: SUPABASE_URL,
  path: path,
  method: 'DELETE',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Prefer': 'return=representation'
  }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    console.log('Status:', res.statusCode);
    var items = JSON.parse(data);
    console.log('Deleted count:', items.length);
    items.forEach(function(item) {
      console.log('  Deleted:', item.property_number);
    });
  });
});
req.end();
