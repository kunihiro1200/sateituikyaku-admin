// on_hold が 'N' の物件を確認して削除するスクリプト
// 'N' は「保留ではない」を意味するが、isNotBlank判定で保留扱いされていた
var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

// Step 1: on_holdが空でない物件を全て取得
var req = https.request({
  hostname: SUPABASE_URL,
  path: '/rest/v1/work_tasks?on_hold=not.is.null&on_hold=not.eq.&select=id,property_number,on_hold',
  method: 'GET',
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var tasks = JSON.parse(data);
    console.log('on_holdに値がある物件数:', tasks.length);
    tasks.forEach(function(t) {
      console.log('  ' + t.property_number + ' -> on_hold: "' + t.on_hold + '"');
    });

    // 'N' の物件を特定
    var toFix = tasks.filter(function(t) { return t.on_hold === 'N'; });
    console.log('\non_hold="N" の物件数:', toFix.length);
    toFix.forEach(function(t) {
      console.log('  ' + t.property_number);
    });

    if (toFix.length === 0) {
      console.log('\n修正対象なし');
      return;
    }

    // on_hold を null にクリアする
    console.log('\non_holdをnullにクリアします...');
    toFix.forEach(function(t) {
      var patchReq = https.request({
        hostname: SUPABASE_URL,
        path: '/rest/v1/work_tasks?id=eq.' + t.id,
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }, function(patchRes) {
        var patchData = '';
        patchRes.on('data', function(chunk) { patchData += chunk; });
        patchRes.on('end', function() {
          if (patchRes.statusCode === 200) {
            console.log('  OK: ' + t.property_number + ' on_hold cleared');
          } else {
            console.log('  ERROR: ' + t.property_number + ' status=' + patchRes.statusCode + ' ' + patchData);
          }
        });
      });
      patchReq.write(JSON.stringify({ on_hold: null }));
      patchReq.end();
    });
  });
});
req.end();
