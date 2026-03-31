import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SHEET_NAME = '売主リスト';

async function checkAllColumns() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // B列からV列まで取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B:V`,
  });

  const rows = response.data.values || [];
  const sellerNumbers = ['AA13175', 'AA10618'];

  console.log('スプレッドシートの全カラムを確認:\n');

  for (const sellerNumber of sellerNumbers) {
    const rowIndex = rows.findIndex(row => row[0] === sellerNumber);
    
    if (rowIndex === -1) {
      console.log(`${sellerNumber}: スプレッドシートに見つかりません\n`);
      continue;
    }

    const row = rows[rowIndex];
    console.log(`=== ${sellerNumber} (行${rowIndex + 1}) ===`);
    console.log(`B列 (売主番号): "${row[0] || ''}"`);
    console.log(`C列 (電/日付): "${row[1] || ''}"`);
    console.log(`V列 (名前(漢字のみ）): "${row[20] || ''}"`);
    console.log(`V列のインデックス20の値: "${row[20]}"`);
    console.log(`V列が存在するか: ${row.length > 20}`);
    console.log(`行の長さ: ${row.length}`);
    console.log('');
  }
}

checkAllColumns().catch(console.error);
