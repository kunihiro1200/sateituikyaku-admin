// Test: resolve the shortened URL via the production backend
const https = require('https');

const targetUrl = encodeURIComponent('https://maps.app.goo.gl/jzWdceaA4Th97aWy9');
const apiUrl = `https://sateituikyaku-admin-backend.vercel.app/api/url-redirect/resolve?url=${targetUrl}`;

console.log('Calling:', apiUrl.substring(0, 100));

https.get(apiUrl, { headers: { 'Accept': 'application/json' } }, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body.substring(0, 500));
    
    try {
      const data = JSON.parse(body);
      if (data.redirectedUrl) {
        console.log('\nRedirected URL:', data.redirectedUrl);
        
        // Test COORD_PATTERNS against this URL
        const COORD_PATTERNS = [
          /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
          /!3d(-?\d+\.?\d*)![^!]*!4d(-?\d+\.?\d*)/,
          /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
          /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
          /\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
          /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
          /\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
          /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
          /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        ];
        
        const targets = [data.redirectedUrl];
        try { targets.push(decodeURIComponent(data.redirectedUrl)); } catch {}
        
        for (const target of targets) {
          for (let i = 0; i < COORD_PATTERNS.length; i++) {
            const m = target.match(COORD_PATTERNS[i]);
            if (m) {
              console.log(`\nMATCH! Pattern[${i}]: lat=${m[1]}, lng=${m[2]}`);
              return;
            }
          }
        }
        console.log('\nNO MATCH - no pattern matched the redirected URL');
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('Request error:', e.message));
