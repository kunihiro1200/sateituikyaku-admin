import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

async function check() {
  console.log('=== Checking AA13863 in Spreadsheet ===\n');
  
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID!,
    sheetName: '物件',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  
  await sheetsClient.authenticate();
  
  // ヘッダー行を取得
  const headers = await sheetsClient.getHeaders();
  console.log('Total columns:', headers.length);
  
  // DQ列のインデックスを探す
  const dqIndex = headers.findIndex(h => h === '確認');
  console.log('DQ列（確認）のインデックス:', dqIndex);
  if (dqIndex >= 0) {
    console.log('DQ列のヘッダー名:', headers[dqIndex]);
  }
  
  // AA13863の行を探す
  const allRows = await sheetsClient.readAll();
  const targetRow = allRows.find(row => row['物件番号'] === 'AA13863');
  
  if (!targetRow) {
    console.log('AA13863が見つかりません');
    return;
  }
  
  console.log('\n=== AA13863 Row Data ===');
  console.log('物件番号:', targetRow['物件番号']);
  console.log('確認（by name）:', JSON.stringify(targetRow['確認']));
  
  // DQ列周辺のデータも確認
  if (dqIndex >= 0) {
    console.log('\n=== DQ列周辺のヘッダー ===');
    for (let i = Math.max(0, dqIndex - 2); i <= Math.min(headers.length - 1, dqIndex + 2); i++) {
      console.log(`列${i}: ${headers[i]}`);
    }
  }
}

check();
