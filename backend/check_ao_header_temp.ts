import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkHeaders() {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
  const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';
  
  console.log('SPREADSHEET_ID:', SPREADSHEET_ID ? SPREADSHEET_ID.substring(0, 10) + '...' : 'NOT SET');
  console.log('SHEET_NAME:', SHEET_NAME);
  
  const client = new GoogleSheetsClient({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });
  
  await client.authenticate();
  const headers = await client.getHeaders();
  
  console.log('\n=== 全ヘッダー一覧（35列目〜50列目）===');
  for (let i = 35; i <= Math.min(50, headers.length - 1); i++) {
    const colIndex = i;
    let colLetter = '';
    let n = colIndex;
    while (n >= 0) {
      colLetter = String.fromCharCode((n % 26) + 65) + colLetter;
      n = Math.floor(n / 26) - 1;
    }
    console.log(`${colLetter}列(${i}): [${JSON.stringify(headers[i])}]`);
  }
  
  // 「査定」を含むヘッダーを検索
  console.log('\n=== 「査定」を含むヘッダー ===');
  headers.forEach((h, i) => {
    if (h && String(h).includes('査定')) {
      let colLetter = '';
      let n = i;
      while (n >= 0) {
        colLetter = String.fromCharCode((n % 26) + 65) + colLetter;
        n = Math.floor(n / 26) - 1;
      }
      console.log(`${colLetter}列(${i}): [${JSON.stringify(h)}]`);
    }
  });
  
  // AA13811のデータを確認
  console.log('\n=== AA13811のデータ確認 ===');
  const rows = await client.readAll();
  const row13811 = rows.find(r => r['売主番号'] === 'AA13811');
  if (row13811) {
    console.log('AA13811 査定関連フィールド:');
    Object.entries(row13811).forEach(([k, v]) => {
      if (String(k).includes('査定')) {
        console.log(`  [${JSON.stringify(k)}]: ${JSON.stringify(v)}`);
      }
    });
  } else {
    console.log('AA13811が見つかりません');
  }
}

checkHeaders().catch(console.error);
