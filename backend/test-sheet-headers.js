// スプレッドシートのヘッダーを確認するスクリプト
// メールアドレス列が正しく認識されるか確認

var https = require('https');

// バックエンドAPIを呼んでスプレッドシート同期をトリガー
var BACKEND_URL = 'sateituikyaku-admin-backend.vercel.app';
var sellerId = '38236f03-4560-4ebd-af82-fd86c7186d2a'; // AA14275

console.log('=== スプレッドシート同期テスト ===');
console.log('売主ID:', sellerId);
console.log('バックエンドURL:', BACKEND_URL);
console.log('');

// PUT /api/sellers/:id でメールアドレスを更新してスプシ同期をトリガー
var body = JSON.stringify({ email: 'test-sync@example.com' });

var req = https.request({
  hostname: BACKEND_URL,
  path: '/api/sellers/' + sellerId,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    console.log('HTTPステータス:', res.statusCode);
    try {
      var result = JSON.parse(data);
      console.log('レスポンス email:', result.email);
      if (res.statusCode === 200) {
        console.log('\n✅ API更新成功。スプレッドシートを確認してください。');
      } else {
        console.log('\n❌ API更新失敗:', result.error || data.substring(0, 200));
      }
    } catch(e) {
      console.log('レスポンス:', data.substring(0, 300));
    }
  });
});
req.write(body);
req.end();
