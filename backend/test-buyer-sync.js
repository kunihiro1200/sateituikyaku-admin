const https = require('https');

const options = {
  hostname: 'sateituikyaku-admin-backend.vercel.app',
  path: '/api/sync/trigger?buyerAddition=true&additionOnly=true',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=',
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, function(res) {
  let data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', function(e) {
  console.log('Error:', e.message);
});

req.end();
