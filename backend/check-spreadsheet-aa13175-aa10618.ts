import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SHEET_NAME = '売主リスト';

async function checkSpreadsheet() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // B列（売主番号）とV列（名前）を取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B:V`,
  });

  const rows = response.data.values || [];
  const sellerNumbers = ['AA13175', 'AA10618'];

  console.log('スプレッドシートから売主名を確認:\n');

  for (const sellerNumber of sellerNumbers) {
    const rowIndex = rows.findIndex(row => row[0] === sellerNumber);
    
    if (rowIndex === -1) {
      console.log(`${sellerNumber}: スプレッドシートに見つかりません`);
    } else {
      // V列は0-indexedで21番目（B=0, C=1, ..., V=20）
      const name = rows[rowIndex][20] || '';
      console.log(`${sellerNumber}:`);
      console.log(`  行番号: ${rowIndex + 1}`);
      console.log(`  V列の名前: "${name}"`);
      console.log(`  名前の長さ: ${name.length}`);
      console.log(`  名前が空: ${name === ''}`);
      console.log(`  名前が"不明": ${name === '不明'}`);
    }
    console.log('');
  }
}

checkSpreadsheet().catch(console.error);
