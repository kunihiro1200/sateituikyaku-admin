// メールアドレスのスプレッドシート同期をデバッグするスクリプト
// 使い方: node check-email-sync.js <売主番号>

var https = require('https');
var SUPABASE_URL = 'krxhrbtlgfjzsseegaqq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

var sellerNumber = process.argv[2] || 'AA14275';

console.log('=== メールアドレス同期デバッグ ===');
console.log('売主番号:', sellerNumber);

// 1. DBから売主データを取得
var req = https.request({
  hostname: SUPABASE_URL,
  path: '/rest/v1/sellers?seller_number=eq.' + sellerNumber + '&select=id,seller_number,email,email_hash',
  method: 'GET',
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    var sellers = JSON.parse(data);
    if (sellers.length === 0) {
      console.log('❌ 売主が見つかりません');
      return;
    }
    var seller = sellers[0];
    console.log('\n--- DBデータ ---');
    console.log('ID:', seller.id);
    console.log('email (暗号化):', seller.email ? seller.email.substring(0, 30) + '...' : 'null');
    console.log('email_hash:', seller.email_hash ? seller.email_hash.substring(0, 20) + '...' : 'null');
    
    if (!seller.email) {
      console.log('\n⚠️ DBにメールアドレスが保存されていません。');
      console.log('管理画面でメールアドレスを入力してから再度確認してください。');
    } else {
      console.log('\n✅ DBにメールアドレスが保存されています（暗号化済み）。');
      console.log('スプレッドシートへの同期が問題の可能性があります。');
    }
  });
});
req.end();
