import * as https from 'https';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

const url = 'https://sateituikyaku-admin-backend.vercel.app/api/sync/trigger';
const secret = process.env.CRON_SECRET || '';

const options = {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + secret,
    'Content-Type': 'application/json',
  }
};

const req = https.request(url, options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body.slice(0, 500));
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
