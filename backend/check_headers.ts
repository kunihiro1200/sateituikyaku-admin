import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function main() {
  const sheetsConfig = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };

  const client = new GoogleSheetsClient(sheetsConfig);
  await client.authenticate();
  const headers = await client.getHeaders();
  
  console.log('=== Y列付近（20-30列目）===');
  for (let i = 19; i < Math.min(30, headers.length); i++) {
    const colNum = i + 1;
    let colLetter = '';
    let n = colNum;
    while (n > 0) {
      const rem = (n - 1) % 26;
      colLetter = String.fromCharCode(65 + rem) + colLetter;
      n = Math.floor((n - 1) / 26);
    }
    console.log(`${colNum}列目 (${colLetter}): "${headers[i]}"`);
  }
  
  console.log('\n=== 「TEL」「電話」「番」を含むヘッダー ===');
  headers.forEach((h: string, i: number) => {
    if (h && (h.includes('TEL') || h.includes('電話') || h.includes('番') || h.includes('tel'))) {
      const colNum = i + 1;
      let colLetter = '';
      let n = colNum;
      while (n > 0) {
        const rem = (n - 1) % 26;
        colLetter = String.fromCharCode(65 + rem) + colLetter;
        n = Math.floor((n - 1) / 26);
      }
      console.log(`${colNum}列目 (${colLetter}): "${h}"`);
    }
  });
}

main().catch(console.error);
