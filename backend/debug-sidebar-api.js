const https = require('https');

// sidebar-counts API を直接叩く
const options = {
  hostname: 'sateituikyaku-admin-backend.vercel.app',
  path: '/api/sellers/sidebar-counts',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('unvaluated:', json.unvaluated);
      console.log('todayCallNotStarted:', json.todayCallNotStarted);
      console.log('Full response:', JSON.stringify(json, null, 2));
    } catch(e) {
      console.log('Raw:', data.substring(0, 1000));
    }
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
