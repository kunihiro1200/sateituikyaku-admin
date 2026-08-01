// 保留物件6件をwork_tasksテーブルから削除
var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

var TO_DELETE = ['AA319', 'AA6078', 'AA6381', 'AA206', 'AA6362', 'AA12637'];

TO_DELETE.forEach(function(pn) {
  var req = https.request({
    hostname: SUPABASE_URL,
    path: '/rest/v1/work_tasks?property_number=eq.' + pn,
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
      if (res.statusCode === 200) {
        console.log('DELETED: ' + pn);
      } else {
        console.log('ERROR: ' + pn + ' status=' + res.statusCode + ' ' + data.substring(0, 200));
      }
    });
  });
  req.end();
});
