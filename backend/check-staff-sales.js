/**
 * スタッフシートの「営業」列を確認するスクリプト
 */
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  // スタッフシートを読み取る
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
    range: 'スタッフ!A1:Z100',
  });
  
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    console.log('データなし');
    return;
  }
  
  const headers = rows[0];
  console.log('\n=== 列名一覧 ===');
  headers.forEach((h, i) => console.log(`  ${i}: ${h}`));
  
  // 「営業」列のインデックスを探す
  const salesIdx = headers.indexOf('営業');
  const emailIdx = headers.findIndex(h => h === 'メアド' || h === 'メールアドレス' || h === 'email');
  const nameIdx = headers.findIndex(h => h === '名前' || h === '氏名' || h === 'スタッフ名');
  
  console.log(`\n営業列: index=${salesIdx}, メアド列: index=${emailIdx}, 名前列: index=${nameIdx}`);
  console.log('\n=== スタッフ一覧 ===');
  console.log('名前 | メアド | 営業');
  console.log('------|--------|------');
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = nameIdx >= 0 ? (row[nameIdx] || '') : '(不明)';
    const email = emailIdx >= 0 ? (row[emailIdx] || '') : '(不明)';
    const sales = salesIdx >= 0 ? (row[salesIdx] || '(空)') : '(列なし)';
    if (name || email) {
      console.log(`${name} | ${email} | ${sales}`);
    }
  }
}

main().catch(console.error);
