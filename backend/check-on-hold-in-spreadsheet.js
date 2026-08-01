// 保留物件がスプレッドシートに存在するか確認するスクリプト
// バックエンドAPIの sync/:propertyNumber を使って確認
var https = require('https');

var BACKEND_HOST = 'sateituikyaku-admin-backend.vercel.app';
var ON_HOLD_PROPERTIES = ['AA9830', 'AA10204', 'AA6362', 'AA12637', 'AA6078', 'AA6381', 'AA319', 'AA206'];

var notFound = [];
var found = [];
var completed = 0;

ON_HOLD_PROPERTIES.forEach(function(pn) {
  var req = https.request({
    hostname: BACKEND_HOST,
    path: '/api/work-tasks/sync/' + pn,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      completed++;
      if (res.statusCode === 404) {
        notFound.push(pn);
        console.log('NOT FOUND in spreadsheet: ' + pn);
      } else if (res.statusCode === 200) {
        found.push(pn);
        console.log('FOUND in spreadsheet: ' + pn);
      } else {
        console.log(pn + ' -> status=' + res.statusCode + ' body=' + data.substring(0, 200));
      }

      if (completed === ON_HOLD_PROPERTIES.length) {
        console.log('\n=== 結果 ===');
        console.log('スプレッドシートに存在: ' + found.join(', '));
        console.log('スプレッドシートに不在: ' + notFound.join(', '));
        console.log('\n不在の物件数: ' + notFound.length);
      }
    });
  });
  req.end();
});
