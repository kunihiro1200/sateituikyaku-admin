import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SHEET_NAME = '売主リスト';

async function checkHeaders() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1行目（ヘッダー行）を取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`,
  });

  const headers = response.data.values?.[0] || [];

  console.log('スプレッドシートのヘッダー行:\n');
  
  // B列からV列までを表示（インデックス1から21まで）
  for (let i = 1; i <= 21; i++) {
    const columnLetter = String.fromCharCode(65 + i); // B=66, C=67, ..., V=87
    const header = headers[i] || '(空)';
    console.log(`${columnLetter}列 (index ${i}): "${header}"`);
  }
}

checkHeaders().catch(console.error);
