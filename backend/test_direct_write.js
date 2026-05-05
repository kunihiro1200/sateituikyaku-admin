// 直接Google Sheets APIでAB89に書き込みテスト
const { google } = require('googleapis');
const fs = require('fs');

// Vercel環境変数から取得（ローカルでは.env.localから）
require('dotenv').config({ path: '.env.local' });

const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!keyJson) { console.error('GOOGLE_SERVICE_ACCOUNT_JSON not found'); process.exit(1); }

let key;
try {
  // ローカルファイルから読み込み
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
  const fs2 = require('fs');
  key = JSON.parse(fs2.readFileSync(keyPath, 'utf8'));
} catch(e) { console.error('Key load error:', e.message); process.exit(1); }

const auth = new google.auth.GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetId = '1pu66LWhtbHt8_HxInR4OHIpLHpIJNaZqukix38gdo1w';
const sheetName = '重説';
const range = `'${sheetName}'!AB89`;

console.log('Testing write to:', range);

sheets.spreadsheets.values.update({
  spreadsheetId,
  range,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [['TEST']] }
}).then(res => {
  console.log('SUCCESS:', res.data.updatedRange);
}).catch(e => {
  console.error('ERROR:', e.message);
  if (e.errors) console.error('Details:', JSON.stringify(e.errors));
});
